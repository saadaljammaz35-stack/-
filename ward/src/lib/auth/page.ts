import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { readSession, sessionCookieName, type Session } from '@/lib/auth/session';
import { can, type Permission } from '@/lib/auth/permissions';

/** Server-component guard: every /os page calls this before reading any data. */
export async function requirePage(permission: Permission = 'read'): Promise<Session> {
  const jar = await cookies();
  const session = await readSession(jar.get(sessionCookieName())?.value);
  if (!session) redirect('/os/login');
  if (!can(session.role, permission)) redirect('/os?error=forbidden');
  return session;
}

export async function optionalSession(): Promise<Session | null> {
  const jar = await cookies();
  return readSession(jar.get(sessionCookieName())?.value);
}
