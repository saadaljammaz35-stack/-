import { NextResponse } from 'next/server';
import { assertSameOrigin, route } from '@/lib/http';
import { revokeSession, sessionCookie, tokenFromRequest } from '@/lib/auth/session';

export const POST = route(async (req: Request) => {
  assertSameOrigin(req);
  const token = tokenFromRequest(req);
  if (token) await revokeSession(token);
  const res = NextResponse.redirect(new URL('/os/login', req.url), 303);
  res.headers.append('Set-Cookie', sessionCookie('', 0));
  return res;
});
