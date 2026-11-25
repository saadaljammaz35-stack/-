import { NextResponse } from 'next/server';
import { z } from 'zod';
import { system } from '@/lib/db';
import { clientIp, isFormPost, readBody, route, assertSameOrigin } from '@/lib/http';
import { dummyHash, verifyPassword } from '@/lib/auth/password';
import { createSession, sessionCookie } from '@/lib/auth/session';
import { hit, LIMITS, resetLimit } from '@/lib/security/rate-limit';

const Body = z.object({ email: z.string().trim().toLowerCase().email().max(200), password: z.string().min(1).max(200) });

export const POST = route(async (req: Request) => {
  assertSameOrigin(req);
  const form = isFormPost(req);
  const fail = (code: 'invalid' | 'limited', status: number) =>
    form ? NextResponse.redirect(new URL(`/os/login?error=${code}`, req.url), 303) : NextResponse.json({ error: code }, { status });

  const parsed = Body.safeParse(await readBody(req));
  if (!parsed.success) return fail('invalid', 400);
  const { email, password } = parsed.data;
  const ip = clientIp(req);
  const [byIp, byEmail] = await Promise.all([
    hit(`login:ip:${ip}`, LIMITS.loginPerIp.limit, LIMITS.loginPerIp.windowSec),
    hit(`login:email:${email}`, LIMITS.loginPerEmail.limit, LIMITS.loginPerEmail.windowSec),
  ]);
  if (!byIp.allowed || !byEmail.allowed) return fail('limited', 429);

  const user = await system(async (q) =>
    (await q.query<{ id: string; password_hash: string; org_id: string | null }>(
      `select u.id, u.password_hash,
              (select m.org_id from ward.organization_members m where m.user_id = u.id order by (m.role = 'owner') desc, m.created_at limit 1) as org_id
         from ward.users u where u.email = $1 and not u.disabled`,
      [email],
    ))[0],
  );
  // Same work whether or not the account exists (no user enumeration by timing).
  const ok = await verifyPassword(password, user?.password_hash ?? (await dummyHash()));
  if (!user || !ok || !user.org_id) return fail('invalid', 401);

  await resetLimit(`login:email:${email}`);
  const { token, maxAgeSec } = await createSession({ userId: user.id, orgId: user.org_id, ip, userAgent: req.headers.get('user-agent') ?? '' });
  await system((q) =>
    q.query(`insert into ward.audit_logs (org_id, actor_type, actor_id, action, ip) values ($1,'user',$2,'auth.login',$3)`, [user.org_id, user.id, ip]),
  );
  const res = form ? NextResponse.redirect(new URL('/os', req.url), 303) : NextResponse.json({ ok: true });
  res.headers.append('Set-Cookie', sessionCookie(token, maxAgeSec));
  return res;
});
