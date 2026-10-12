// Configuration comes only from environment variables (Supabase Edge
// Function secrets). A missing required value surfaces as a ConfigError,
// which the HTTP layer turns into a 503 naming the variable, never a crash
// and never a silent fallback that pretends an integration works.

export class ConfigError extends Error {
  constructor(readonly variable: string) {
    super(`Missing configuration: ${variable}`);
    this.name = "ConfigError";
  }
}

export function optionalEnv(name: string): string | undefined {
  const value = Deno.env.get(name);
  return value !== undefined && value.trim() !== "" ? value.trim() : undefined;
}

export function requireEnv(name: string): string {
  const value = optionalEnv(name);
  if (value === undefined) throw new ConfigError(name);
  return value;
}

export function intEnv(name: string, fallback: number): number {
  const raw = optionalEnv(name);
  if (raw === undefined) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
