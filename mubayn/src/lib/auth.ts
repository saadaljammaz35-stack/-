import { cookies } from "next/headers";
import { config } from "./config";
import { randomToken, sha256 } from "./crypto";
import { one, query, type Db } from "./db";
import { forbidden, unauthorized } from "./errors";

/**
 * Sessions are opaque random tokens. The browser holds the token in an
 * HttpOnly, Secure, SameSite=Lax cookie; the database holds only its SHA-256,
 * so a database leak does not leak usable sessions.
 */

export const SESSION_TTL_DAYS = 30;
const ADMIN_IDLE_MINUTES = 60;

export type SessionUser = {
  id: string;
  email: string;
  full_name: string | null;
  locale: "ar" | "en";
  role: "customer" | "admin";
  email_verified_at: Date | null;
  mfa_enabled_at: Date | null;
};

export type Session = { id: string; mfa_verified: boolean; last_seen_at: Date; user: SessionUser };

export function sessionCookieName(): string {
  return config().NODE_ENV === "production" ? "__Host-mubayn_session" : "mubayn_session";
}

export async function createSession(
  userId: string,
  meta: { ip: string | null; userAgent: string | null; mfaVerified?: boolean },
  db?: Db,
): Promise<string> {
  const token = randomToken(32);
  await query(
    `INSERT INTO sessions (user_id, token_hash, mfa_verified, ip, user_agent, expires_at)
     VALUES ($1, $2, $3, $4, $5, now() + make_interval(days => $6))`,
    [userId, sha256(token), meta.mfaVerified ?? false, meta.ip, meta.userAgent?.slice(0, 400) ?? null, SESSION_TTL_DAYS],
    db,
  );
  return token;
}

export async function setSessionCookie(token: string): Promise<void> {
  const jar = await cookies();
  jar.set(sessionCookieName(), token, {
    httpOnly: true,
    secure: config().NODE_ENV === "production" || config().APP_URL.startsWith("https://"),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_DAYS * 24 * 3600,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(sessionCookieName());
}

export async function sessionFromToken(token: string | undefined): Promise<Session | null> {
  if (!token || token.length > 100) return null;
  const row = await one<{
    sid: string;
    mfa_verified: boolean;
    last_seen_at: Date;
    id: string;
    email: string;
    full_name: string | null;
    locale: "ar" | "en";
    role: "customer" | "admin";
    email_verified_at: Date | null;
    mfa_enabled_at: Date | null;
  }>(
    `SELECT s.id AS sid, s.mfa_verified, s.last_seen_at,
            u.id, u.email, u.full_name, u.locale, u.role, u.email_verified_at, u.mfa_enabled_at
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now() AND u.status = 'active'`,
    [sha256(token)],
  );
  if (!row) return null;
  if (Date.now() - row.last_seen_at.getTime() > 5 * 60_000) {
    await query(`UPDATE sessions SET last_seen_at = now() WHERE id = $1`, [row.sid]);
  }
  const { sid, mfa_verified, last_seen_at, ...user } = row;
  return { id: sid, mfa_verified, last_seen_at, user };
}

export async function currentSession(): Promise<Session | null> {
  const jar = await cookies();
  return sessionFromToken(jar.get(sessionCookieName())?.value);
}

export async function requireUser(): Promise<Session> {
  const s = await currentSession();
  if (!s) throw unauthorized();
  return s;
}

export async function requireVerifiedUser(): Promise<Session> {
  const s = await requireUser();
  if (!s.user.email_verified_at) throw forbidden("Verify your e-mail address first");
  return s;
}

/** Admin = admin role + enrolled TOTP + this session passed the TOTP check + not idle. */
export async function requireAdmin(): Promise<Session> {
  const s = await requireUser();
  if (s.user.role !== "admin") throw forbidden();
  if (!s.user.mfa_enabled_at || !s.mfa_verified) throw forbidden("Two-factor verification required");
  if (Date.now() - s.last_seen_at.getTime() > ADMIN_IDLE_MINUTES * 60_000) throw unauthorized("Admin session expired");
  return s;
}

export async function revokeSession(sessionId: string): Promise<void> {
  await query(`UPDATE sessions SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL`, [sessionId]);
}

export async function revokeAllSessions(userId: string, exceptSessionId: string | null = null, db?: Db): Promise<void> {
  await query(
    `UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL AND ($2::uuid IS NULL OR id <> $2::uuid)`,
    [userId, exceptSessionId],
    db,
  );
}
