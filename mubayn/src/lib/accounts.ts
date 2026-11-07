import { randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { audit } from "./audit";
import { createSession, revokeAllSessions } from "./auth";
import { config, emailEnabled } from "./config";
import { hashPassword, randomToken, sha256, verifyPassword } from "./crypto";
import { one, query, tx, type Db } from "./db";
import { sendEmail } from "./email";
import { AppError, badRequest, conflict, unauthorized } from "./errors";
import { rateLimit } from "./ratelimit";
import { storage } from "./storage";
import { base32Encode } from "./totp";

export const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const passwordSchema = z
  .string()
  .min(10, "At least 10 characters")
  .max(128, "At most 128 characters")
  .refine((p) => new Set(p).size >= 5, "Too repetitive");

const MAX_FAILED_LOGINS = 8;
const LOCK_MINUTES = 15;

async function issueEmailToken(userId: string, purpose: "verify_email" | "reset_password", hours: number): Promise<string> {
  const token = randomToken(32);
  // One live token per purpose: older ones stop working.
  await query(`UPDATE email_tokens SET used_at = now() WHERE user_id = $1 AND purpose = $2 AND used_at IS NULL`, [userId, purpose]);
  await query(
    `INSERT INTO email_tokens (user_id, purpose, token_hash, expires_at) VALUES ($1, $2, $3, now() + make_interval(hours => $4))`,
    [userId, purpose, sha256(token), hours],
  );
  return token;
}

async function consumeEmailToken(token: string, purpose: "verify_email" | "reset_password"): Promise<string> {
  const row = await one<{ user_id: string }>(
    `UPDATE email_tokens SET used_at = now()
      WHERE token_hash = $1 AND purpose = $2 AND used_at IS NULL AND expires_at > now()
      RETURNING user_id`,
    [sha256(token), purpose],
  );
  if (!row) throw badRequest("invalid_token", "This link is invalid or has expired");
  return row.user_id;
}

// ── recovery codes (deployments without e-mail) ────────────────────────────
// 20 base32 characters = 100 random bits, shown once as XXXXX-XXXXX-XXXXX-XXXXX.
// High entropy, so a plain SHA-256 is enough (like session tokens).

export function normalizeRecoveryCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z2-7]/g, "");
}

const recoveryHash = (code: string) => sha256(`recovery:${normalizeRecoveryCode(code)}`);

/** Replaces the user's recovery code (the old one stops working) and returns the new one. */
export async function issueRecoveryCode(userId: string, db?: Db): Promise<string> {
  const raw = base32Encode(randomBytes(13)).slice(0, 20);
  await query(
    `UPDATE users SET recovery_code_hash = $2, recovery_code_created_at = now(), updated_at = now() WHERE id = $1`,
    [userId, recoveryHash(raw)],
    db,
  );
  return raw.match(/.{5}/g)!.join("-");
}

/** Sets a new password using the recovery code; returns the replacement code. */
export async function recoverWithCode(email: string, code: string, newPassword: string, ip: string | null): Promise<string> {
  await rateLimit(`recover:ip:${ip ?? "unknown"}`, 10, 3600);
  await rateLimit(`recover:email:${email}`, 5, 3600);
  const u = await one<{ id: string; recovery_code_hash: Buffer | null }>(
    `SELECT id, recovery_code_hash FROM users WHERE email = $1 AND status = 'active'`,
    [email],
  );
  const given = recoveryHash(code);
  const stored = u?.recovery_code_hash ?? null;
  const ok = stored !== null && stored.length === given.length && timingSafeEqual(stored, given);
  if (!u || !ok) {
    if (u) await audit(u.id, "auth.recovery_failed", { type: "user", id: u.id }, {}, ip);
    throw badRequest("invalid_recovery", "The e-mail or recovery code is incorrect");
  }
  const hash = await hashPassword(newPassword);
  return tx(async (db) => {
    await query(`UPDATE users SET password_hash = $2, failed_logins = 0, locked_until = NULL, updated_at = now() WHERE id = $1`, [u.id, hash], db);
    const next = await issueRecoveryCode(u.id, db);
    await revokeAllSessions(u.id, null, db);
    await audit(u.id, "auth.password_recovered", { type: "user", id: u.id }, {}, ip, db);
    return next;
  });
}

/** A signed-in customer replaces a lost or exposed recovery code. */
export async function regenerateRecoveryCode(userId: string, password: string): Promise<string> {
  await rateLimit(`recovery-regen:${userId}`, 5, 3600);
  const u = await one<{ password_hash: string }>(`SELECT password_hash FROM users WHERE id = $1 AND status = 'active'`, [userId]);
  if (!(await verifyPassword(password, u?.password_hash ?? null))) throw unauthorized("Password is incorrect");
  const code = await issueRecoveryCode(userId);
  await audit(userId, "account.recovery_code_regenerated", { type: "user", id: userId });
  return code;
}

export async function register(input: { email: string; password: string; fullName: string; locale: "ar" | "en" }, ip: string | null): Promise<
  { created: false } | { created: true; userId: string; recoveryCode: string | null }
> {
  await rateLimit(`register:ip:${ip ?? "unknown"}`, 10, 3600);
  const app = config().APP_URL;
  const existing = await one<{ id: string; locale: "ar" | "en"; status: string }>(`SELECT id, locale, status FROM users WHERE email = $1`, [input.email]);
  if (existing && !emailEnabled()) {
    // Without e-mail there is no private channel to the real owner, so say it.
    throw conflict("email_taken", "An account with this e-mail already exists. Sign in instead.");
  }
  if (existing) {
    // Same response as a fresh sign-up, so the form cannot be used to discover
    // who has an account. The real owner gets an e-mail instead.
    if (existing.status === "active") {
      await sendEmail(input.email, { name: "account_exists", loginLink: `${app}/login`, resetLink: `${app}/forgot-password` }, existing.locale, existing.id);
    }
    return { created: false };
  }
  const hash = await hashPassword(input.password);
  const user = await one<{ id: string }>(
    `INSERT INTO users (email, password_hash, full_name, locale) VALUES ($1, $2, $3, $4) RETURNING id`,
    [input.email, hash, input.fullName, input.locale],
  ).catch((e: { code?: string }) => {
    if (e.code === "23505") throw conflict("email_taken", "An account with this e-mail already exists. Sign in instead.");
    throw e;
  });
  if (!emailEnabled()) {
    // The account works at once; the e-mail address stays unverified.
    const recoveryCode = await issueRecoveryCode(user!.id);
    await audit(user!.id, "account.registered", { type: "user", id: user!.id }, { email: "none" }, ip);
    return { created: true, userId: user!.id, recoveryCode };
  }
  const token = await issueEmailToken(user!.id, "verify_email", 24);
  await sendEmail(input.email, { name: "verify_email", link: `${app}/verify-email?token=${token}` }, input.locale, user!.id);
  await audit(user!.id, "account.registered", { type: "user", id: user!.id }, {}, ip);
  return { created: true, userId: user!.id, recoveryCode: null };
}

export async function resendVerification(userId: string): Promise<void> {
  if (!emailEnabled()) return;
  await rateLimit(`verify-resend:${userId}`, 5, 3600);
  const u = await one<{ email: string; locale: "ar" | "en"; email_verified_at: Date | null }>(
    `SELECT email, locale, email_verified_at FROM users WHERE id = $1 AND status = 'active'`,
    [userId],
  );
  if (!u || u.email_verified_at) return;
  const token = await issueEmailToken(userId, "verify_email", 24);
  await sendEmail(u.email, { name: "verify_email", link: `${config().APP_URL}/verify-email?token=${token}` }, u.locale, userId);
}

export async function verifyEmail(token: string): Promise<void> {
  // Opening the same link twice (double click, mail-client prefetch) is not an error.
  const already = await one<{ user_id: string }>(
    `SELECT t.user_id FROM email_tokens t JOIN users u ON u.id = t.user_id
      WHERE t.token_hash = $1 AND t.purpose = 'verify_email' AND t.used_at IS NOT NULL AND t.expires_at > now()
        AND u.email_verified_at IS NOT NULL`,
    [sha256(token)],
  );
  if (already) return;
  const userId = await consumeEmailToken(token, "verify_email");
  await query(`UPDATE users SET email_verified_at = COALESCE(email_verified_at, now()), updated_at = now() WHERE id = $1`, [userId]);
  await audit(userId, "account.email_verified", { type: "user", id: userId });
}

export async function login(email: string, password: string, meta: { ip: string | null; userAgent: string | null }) {
  await rateLimit(`login:ip:${meta.ip ?? "unknown"}`, 30, 900);
  await rateLimit(`login:email:${email}`, 15, 900);
  const u = await one<{ id: string; password_hash: string | null; status: string; locked_until: Date | null; failed_logins: number; role: string }>(
    `SELECT id, password_hash, status, locked_until, failed_logins, role FROM users WHERE email = $1`,
    [email],
  );
  const ok = await verifyPassword(password, u?.status === "active" ? (u.password_hash ?? null) : null);
  if (u && u.locked_until && u.locked_until.getTime() > Date.now()) {
    throw new AppError(423, "locked", `Too many failed attempts. Try again after ${LOCK_MINUTES} minutes or reset your password.`);
  }
  if (!u || !ok || u.status !== "active") {
    if (u && u.status === "active") {
      await query(
        `UPDATE users SET failed_logins = failed_logins + 1,
                locked_until = CASE WHEN failed_logins + 1 >= $2 THEN now() + make_interval(mins => $3) ELSE locked_until END
          WHERE id = $1`,
        [u.id, MAX_FAILED_LOGINS, LOCK_MINUTES],
      );
      await audit(u.id, "auth.login_failed", { type: "user", id: u.id }, {}, meta.ip);
    }
    throw unauthorized("Incorrect e-mail or password");
  }
  await query(`UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = $1`, [u.id]);
  const token = await createSession(u.id, meta);
  await audit(u.id, "auth.login", { type: "user", id: u.id }, {}, meta.ip);
  return { token, userId: u.id, role: u.role };
}

export async function requestPasswordReset(email: string, ip: string | null): Promise<void> {
  if (!emailEnabled()) throw badRequest("email_disabled", "This site does not send e-mail. Use your recovery code.");
  await rateLimit(`reset:ip:${ip ?? "unknown"}`, 10, 3600);
  await rateLimit(`reset:email:${email}`, 3, 3600);
  const u = await one<{ id: string; locale: "ar" | "en" }>(`SELECT id, locale FROM users WHERE email = $1 AND status = 'active'`, [email]);
  if (!u) return; // Same response either way.
  const token = await issueEmailToken(u.id, "reset_password", 1);
  await sendEmail(email, { name: "reset_password", link: `${config().APP_URL}/reset-password?token=${token}` }, u.locale, u.id);
  await audit(u.id, "auth.reset_requested", { type: "user", id: u.id }, {}, ip);
}

export async function resetPassword(token: string, newPassword: string, ip: string | null): Promise<void> {
  const userId = await consumeEmailToken(token, "reset_password");
  const hash = await hashPassword(newPassword);
  await tx(async (db) => {
    // Opening the e-mailed link also proves ownership of the address.
    await query(
      `UPDATE users SET password_hash = $2, failed_logins = 0, locked_until = NULL,
              email_verified_at = COALESCE(email_verified_at, now()), updated_at = now() WHERE id = $1`,
      [userId, hash],
      db,
    );
    await revokeAllSessions(userId, null, db);
    await audit(userId, "auth.password_reset", { type: "user", id: userId }, {}, ip, db);
  });
}

export async function changePassword(userId: string, sessionId: string, current: string, next: string): Promise<void> {
  await rateLimit(`pwchange:${userId}`, 10, 3600);
  const u = await one<{ password_hash: string }>(`SELECT password_hash FROM users WHERE id = $1`, [userId]);
  if (!(await verifyPassword(current, u?.password_hash ?? null))) throw unauthorized("Current password is incorrect");
  await query(`UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1`, [userId, await hashPassword(next)]);
  await revokeAllSessions(userId, sessionId);
  await audit(userId, "auth.password_changed", { type: "user", id: userId });
}

/**
 * Deletes a customer account permanently: evidence files, video frames, the
 * copies sent to the AI and report PDFs are removed from storage, then the
 * user row is deleted, which cascades to sessions, inspections, evidence,
 * analysis attempts, reports and findings. The audit log keeps only the
 * fact that an account id was deleted, with no personal data.
 */
export async function deleteAccount(userId: string, password: string, ip: string | null): Promise<void> {
  const u = await one<{ email: string; password_hash: string; locale: "ar" | "en"; role: string }>(
    `SELECT email, password_hash, locale, role FROM users WHERE id = $1 AND status = 'active'`,
    [userId],
  );
  if (!u || !(await verifyPassword(password, u.password_hash))) throw unauthorized("Password is incorrect");
  if (u.role === "admin") throw conflict("admin_account", "Remove admin rights before deleting this account");
  const running = await one<{ n: number }>(
    `SELECT count(*)::int AS n FROM analysis_jobs j JOIN inspections i ON i.id = j.inspection_id WHERE i.user_id = $1 AND j.status = 'running'`,
    [userId],
  );
  if (running && running.n > 0) throw conflict("analysis_running", "An analysis is running. Try again in a few minutes.");

  await storage().deletePrefix(`u/${userId}/`);
  await tx(async (db) => {
    await query(`DELETE FROM users WHERE id = $1`, [userId], db);
    await audit(null, "account.deleted", { type: "user", id: userId }, {}, ip, db);
  });
  await sendEmail(u.email, { name: "account_deleted" }, u.locale, null);
}

/** Everything we hold about a customer, for access requests. */
export async function exportAccount(userId: string) {
  const [user] = await query(`SELECT id, email, full_name, locale, created_at, email_verified_at FROM users WHERE id = $1`, [userId]);
  const inspections = await query(`SELECT * FROM inspections WHERE user_id = $1 ORDER BY created_at`, [userId]);
  const evidence = await query(
    `SELECT id, inspection_id, kind, declared_mime, bytes, sha256, original_filename, label, status, frame_time_ms, created_at FROM evidence WHERE user_id = $1`,
    [userId],
  );
  const reports = await query(
    `SELECT r.id, r.inspection_id, r.version, r.status, r.overall_condition, r.condition_score, r.confidence, r.body, r.created_at,
            (SELECT json_agg(f ORDER BY f.position) FROM findings f WHERE f.report_id = r.id) AS findings
       FROM reports r WHERE r.user_id = $1`,
    [userId],
  );
  return { exported_at: new Date().toISOString(), user, inspections, evidence, reports };
}
