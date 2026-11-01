/**
 * Public runtime configuration. NEXT_PUBLIC_* values are inlined at build time.
 * Secrets (RESEND_API_KEY, SUPABASE_SERVICE_ROLE_KEY) are never read here.
 */
/** Explicit site URL, else the Vercel production domain, else localhost */
function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  const vercel = process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const url = explicit || (vercel ? `https://${vercel}` : "http://localhost:3000");
  return url.replace(/\/$/, "");
}

export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  siteUrl: resolveSiteUrl(),
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
