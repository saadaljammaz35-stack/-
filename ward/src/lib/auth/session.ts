import { system, type MemberRole, type OrgContext } from '@/lib/db';
import { isProduction } from '@/lib/env';
import { newToken, sha256 } from '@/lib/auth/password';
import { can, type Permission } from '@/lib/auth/permissions';
import { assertSameOrigin, clientIp, forbidden, unauthorized } from '@/lib/http';
import { enforce, LIMITS } from '@/lib/security/rate-limit';

export const SESSION_TTL_DAYS = 14;

/** `__Host-` prefix pins the cookie to this exact host over HTTPS (no Domain, Path=/). */
export function sessionCookieName(): string {
  return isProduction() ? '__Host-ward_session' : 'ward_session';
}

export function sessionCookie(token: string, maxAgeSec: number): string {
  const parts = [
    `${sessionCookieName()}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${maxAgeSec}`,
  ];
  if (isProduction()) parts.push('Secure');
  return parts.join('; ');
}

export interface Session extends OrgContext {
  userId: string;
  role: MemberRole;
  name: string;
  email: string;
  sessionId: string;
}

export async function createSession(input: { userId: string; orgId: string; ip?: string; userAgent?: string }) {
  const token = newToken();
  await system(async (q) => {
    await q.query(
      `insert into ward.sessions (id, user_id, org_id, expires_at, ip, user_agent)
       values ($1, $2, $3, now() + make_interval(days => $4::int), $5, $6)`,
      [sha256(token), input.userId, input.orgId, SESSION_TTL_DAYS, input.ip ?? null, (input.userAgent ?? '').slice(0, 300)],
    );
    await q.query('update ward.users set last_login_at = now() where id = $1', [input.userId]);
  });
  return { token, maxAgeSec: SESSION_TTL_DAYS * 86400 };
}

export async function readSession(token: string | null | undefined): Promise<Session | null> {
  if (!token || token.length < 20 || token.length > 100) return null;
  const id = sha256(token);
  return system(async (q) => {
    const rows = await q.query<{
      user_id: string;
      org_id: string;
      role: MemberRole;
      name: string;
      email: string;
      stale: boolean;
    }>(
      `select s.user_id, s.org_id, m.role, u.name, u.email, (s.last_seen_at < now() - interval '5 minutes') as stale
         from ward.sessions s
         join ward.users u on u.id = s.user_id and not u.disabled
         join ward.organization_members m on m.user_id = s.user_id and m.org_id = s.org_id
        where s.id = $1 and s.revoked_at is null and s.expires_at > now()`,
      [id],
    );
    const row = rows[0];
    if (!row) return null;
    if (row.stale) await q.query('update ward.sessions set last_seen_at = now() where id = $1', [id]);
    return { userId: row.user_id, orgId: row.org_id, role: row.role, name: row.name, email: row.email, sessionId: id };
  });
}

export async function revokeSession(token: string): Promise<void> {
  await system((q) => q.query('update ward.sessions set revoked_at = now() where id = $1', [sha256(token)]));
}

export function tokenFromRequest(req: Request): string | null {
  const header = req.headers.get('cookie');
  if (!header) return null;
  const name = sessionCookieName();
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
}

/**
 * Authenticate an API request: valid session, CSRF origin check on mutations,
 * the required permission, and a per-user rate limit on writes.
 */
export async function requireApi(req: Request, permission: Permission = 'read'): Promise<Session> {
  const session = await readSession(tokenFromRequest(req));
  if (!session) throw unauthorized();
  assertSameOrigin(req);
  if (!can(session.role, permission)) throw forbidden(`missing_permission:${permission}`);
  if (req.method !== 'GET') {
    await enforce(`mut:${session.userId}`, LIMITS.mutationPerUser.limit, LIMITS.mutationPerUser.windowSec);
  }
  return { ...session, ip: clientIp(req) };
}
