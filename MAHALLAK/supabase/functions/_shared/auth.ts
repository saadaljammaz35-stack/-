import { createClient, type SupabaseClient, type User } from './deps.ts';
import { HttpError } from './http.ts';

function env(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new HttpError(500, 'server_misconfigured');
  return v;
}

/** Service-role client. Bypasses RLS: only used after the caller is authenticated. */
export function adminClient(): SupabaseClient {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Verifies the caller's access token and returns the user. */
export async function requireUser(req: Request): Promise<User> {
  const header = req.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) throw new HttpError(401, 'not_signed_in');
  const { data, error } = await adminClient().auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'not_signed_in');
  return data.user;
}
