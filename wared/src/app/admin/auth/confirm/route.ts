import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { getSessionClient } from '@/lib/supabase/server';

const TYPES: EmailOtpType[] = ['invite', 'recovery', 'signup', 'email', 'magiclink', 'email_change'];

/** Handles links from Supabase Auth emails (team invites and password resets). */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;
  const next = url.searchParams.get('next');
  const target = next && /^\/admin(\/[a-z0-9/_-]*)?$/i.test(next) ? next : '/admin';
  const db = await getSessionClient();
  if (db && tokenHash && type && TYPES.includes(type)) {
    const { error } = await db.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return NextResponse.redirect(new URL(target, request.url));
  }
  return NextResponse.redirect(new URL('/admin/login?error=link', request.url));
}
