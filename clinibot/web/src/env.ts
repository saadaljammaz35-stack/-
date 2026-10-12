/**
 * Build-time configuration. Only PUBLIC values belong here: everything in a
 * VITE_* variable is shipped to every browser. Data is protected by Row Level
 * Security, not by hiding these values.
 */
export const REQUIRED_ENV = ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"] as const;
export type RequiredEnvName = (typeof REQUIRED_ENV)[number];

export type EnvResult =
  | { ok: true; supabaseUrl: string; supabaseAnonKey: string }
  | { ok: false; missing: RequiredEnvName[]; invalid: RequiredEnvName[] };

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function readEnv(source: Record<string, unknown> = import.meta.env): EnvResult {
  const url = typeof source.VITE_SUPABASE_URL === "string" ? source.VITE_SUPABASE_URL.trim() : "";
  const key =
    typeof source.VITE_SUPABASE_ANON_KEY === "string" ? source.VITE_SUPABASE_ANON_KEY.trim() : "";
  const missing: RequiredEnvName[] = [];
  const invalid: RequiredEnvName[] = [];
  if (!url) missing.push("VITE_SUPABASE_URL");
  else if (!isHttpUrl(url)) invalid.push("VITE_SUPABASE_URL");
  if (!key) missing.push("VITE_SUPABASE_ANON_KEY");
  if (missing.length > 0 || invalid.length > 0) return { ok: false, missing, invalid };
  return { ok: true, supabaseUrl: url.replace(/\/+$/, ""), supabaseAnonKey: key };
}

export const env: EnvResult = readEnv();
