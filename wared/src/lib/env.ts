/**
 * Public (browser-safe) configuration. NEXT_PUBLIC_* values are inlined at build time, so each one is read
 * with a literal `process.env.NAME` access.
 */
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '') || undefined;
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || undefined;

export const publicEnv = {
  siteUrl,
  supabaseUrl,
  supabasePublishableKey,
  /** Demo content for previewing the design without a database. Always labelled on screen. */
  demoContent: process.env.NEXT_PUBLIC_DEMO_CONTENT === '1',
} as const;

export function isSupabaseConfigured(): boolean {
  return Boolean(publicEnv.supabaseUrl && publicEnv.supabasePublishableKey);
}

export function absoluteUrl(path = '/'): string {
  return `${publicEnv.siteUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

export function storagePublicUrl(bucket: string, path: string): string | null {
  if (!publicEnv.supabaseUrl) return null;
  const encoded = path.split('/').map(encodeURIComponent).join('/');
  return `${publicEnv.supabaseUrl}/storage/v1/object/public/${bucket}/${encoded}`;
}
