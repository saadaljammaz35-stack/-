/**
 * Public runtime configuration. NEXT_PUBLIC_* values are inlined at build time.
 * Secrets (RESEND_API_KEY, SUPABASE_SERVICE_ROLE_KEY) are never read here.
 */
export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
};

export function isSupabaseConfigured(): boolean {
  if (!env.supabaseUrl || !env.supabaseAnonKey) return false;
  try {
    new URL(env.supabaseUrl);
    return true;
  } catch {
    return false;
  }
}
