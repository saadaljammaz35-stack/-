"use client";

import type { Dict } from "@/lib/i18n";
import { api, ApiError } from "./api";

/**
 * OpenAI-compatible services with a free tier. The model name is only a
 * starting value: the owner can type any model the service offers.
 */
export const PROVIDER_PRESETS = [
  {
    id: "groq",
    label: "Groq",
    endpoint: "https://api.groq.com/openai/v1",
    model: "openai/gpt-oss-120b",
    keyUrl: "https://console.groq.com/keys",
    keyPrefix: "gsk_",
  },
  {
    id: "gemini",
    label: "Google Gemini",
    endpoint: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-2.5-flash",
    keyUrl: "https://aistudio.google.com/apikey",
    keyPrefix: "AIza",
  },
  { id: "custom", label: "OpenAI-compatible", endpoint: "", model: "", keyUrl: null, keyPrefix: null },
] as const;
export type Preset = (typeof PROVIDER_PRESETS)[number];

export interface ProviderRow {
  id: string;
  providerName: string;
  endpoint: string | null;
  status: string;
  scope: "platform" | "personal";
}

/** Whether the server runs a model of its own, and the owner's working connections. */
export async function loadProviders(): Promise<{ platformConfigured: boolean; personal: ProviderRow[] }> {
  const r = await api<{ platformConfigured: boolean; providers: ProviderRow[] }>("/api/ai/providers");
  // A connection whose last check failed (e.g. a rejected key) is not offered again.
  return { platformConfigured: r.platformConfigured, personal: r.providers.filter((p) => p.scope === "personal" && p.status !== "down") };
}

/** Removes spaces, line breaks and quotes that sneak in when a key is copied on a phone. */
export function cleanKey(raw: string): string {
  return raw.replace(/[\s"'‘’“”]/g, "");
}

/** A readable reason for a failed connection check. */
export function explainConnectError(t: Dict, raw: string | undefined): string {
  const e = raw ?? "";
  if (/\b(401|403)\b|invalid[_ ]api[_ ]key|unauthori[sz]ed|permission/i.test(e)) return t.create.badKey;
  if (/\b404\b/.test(e)) return t.create.badEndpoint;
  if (/\b429\b|rate.?limit|quota/i.test(e)) return t.create.rateLimited;
  return `${t.create.connectFailed}${e ? ` (${e.slice(0, 160)})` : ""}`;
}

/**
 * Registers the provider with the owner's key (sealed on the server) and
 * checks it live. Throws an Error with a message meant for the user.
 */
export async function connectProvider(t: Dict, preset: Preset, endpoint: string, rawKey: string): Promise<string> {
  const apiKey = cleanKey(rawKey);
  if (!apiKey) throw new Error(t.create.badKey);
  if (preset.keyPrefix && !apiKey.startsWith(preset.keyPrefix)) {
    throw new Error(t.create.keyFormat.replace("{prefix}", preset.keyPrefix).replace("{provider}", preset.label));
  }
  let id: string;
  try {
    const created = await api<{ provider: { id: string } }>("/api/ai/providers", {
      body: {
        providerName: `${preset.label} · ${Math.random().toString(36).slice(2, 6)}`,
        providerType: "openai_compatible",
        endpoint: endpoint.trim(),
        apiKey,
      },
    });
    id = created.provider.id;
  } catch (err) {
    throw new Error(err instanceof ApiError ? err.message : t.create.connectFailed);
  }
  const check = await api<{ health: { status: string; error?: string } }>(`/api/ai/providers/${id}/health`, { body: {} });
  if (check.health.status !== "healthy") throw new Error(explainConnectError(t, check.health.error));
  return id;
}
