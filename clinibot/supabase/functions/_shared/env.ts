// Configuration comes only from environment variables (Supabase Edge
// Function secrets). A missing required value surfaces as a ConfigError,
// which the HTTP layer turns into a 503 naming the variable, never a crash
// and never a silent fallback that pretends an integration works.

import { log } from "./log.ts";

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

// Secrets are often pasted from a phone, which can add characters nobody can
// see: right-to-left marks, zero-width spaces, line breaks. HTTP headers
// reject them (the request then fails with a TypeError before it is sent), so
// they are removed. A secret that still has anything other than printable
// ASCII is invalid.
const INVISIBLE_CHAR = /[\s\p{Cf}]/u;
const INVISIBLE = /[\s\p{Cf}]/gu;
const PRINTABLE_ASCII = /^[\x21-\x7E]+$/;
const reported = new Set<string>();

export function cleanSecret(value: string): string {
  return value.replace(INVISIBLE, "");
}

function codePoint(ch: string): string {
  return `U+${(ch.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, "0")}`;
}

/** The cleaned secret, or undefined when it is missing or still invalid. */
export function optionalSecret(name: string): string | undefined {
  const raw = (Deno.env.get(name) ?? "").trim();
  const cleaned = cleanSecret(raw);
  if (cleaned === "") return undefined;
  if (cleaned !== raw && !reported.has(name)) {
    // Once per instance, and only what kind of characters were removed.
    reported.add(name);
    const removed = [...raw].filter((ch) => INVISIBLE_CHAR.test(ch));
    log.warn("config.secret_cleaned", {
      variable: name,
      removed: removed.length,
      kinds: [...new Set(removed.map(codePoint))].slice(0, 10),
    });
  }
  if (!PRINTABLE_ASCII.test(cleaned)) {
    if (!reported.has(`${name}:invalid`)) {
      reported.add(`${name}:invalid`);
      log.error("config.secret_invalid", { variable: name, length: cleaned.length });
    }
    return undefined;
  }
  return cleaned;
}

export function requireSecret(name: string): string {
  const value = optionalSecret(name);
  if (value === undefined) throw new ConfigError(name);
  return value;
}
