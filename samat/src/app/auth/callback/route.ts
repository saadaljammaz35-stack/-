import { NextResponse, type NextRequest } from 'next/server';
import { userDb } from '@/lib/supabase/server';
import { bootstrapStaffUser } from '@/lib/auth/bootstrap';
import { clientIp, rateLimit } from '@/lib/rate-limit';

/**
 * Landing page for the sign-in link in the staff e-mail (PKCE). Works on the same browser that
 * asked for the link; the 6-digit code in the e-mail works everywhere.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get('code');
  const nextParam = url.searchParams.get('next') ?? '/admin';
  const next = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/admin';
  const fail = (reason: string) => NextResponse.redirect(new URL(`/admin/login?error=${reason}`, url.origin));

  if (!code) return fail('link');
  try {
    await rateLimit('staff:callback', await clientIp(), 30, 600);
    const db = await userDb();
    const { data, error } = await db.auth.exchangeCodeForSession(code);
    if (error || !data.user) return fail('link');
    const result = await bootstrapStaffUser(data.user);
    if (!result.ok) {
      await db.auth.signOut();
      return fail(result.reason === 'disabled' ? 'disabled' : 'not_staff');
    }
    const dest = result.role === 'kitchen' && next === '/admin' ? '/kitchen' : next;
    return NextResponse.redirect(new URL(dest, url.origin));
  } catch {
    return fail('link');
  }
}
