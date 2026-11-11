"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/client/api";
import type { Dict } from "@/lib/i18n";

interface ProviderRow {
  id: string;
  providerName: string;
  endpoint: string | null;
  scope: "platform" | "personal";
}

/**
 * OpenAI-compatible endpoints with a free tier. The model name is only a
 * starting value: the owner can type any model the provider serves.
 */
const PRESETS = [
  { id: "groq", label: "Groq", endpoint: "https://api.groq.com/openai/v1", model: "openai/gpt-oss-120b" },
  { id: "gemini", label: "Google Gemini", endpoint: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-2.5-flash" },
  { id: "custom", label: "OpenAI-compatible", endpoint: "", model: "" },
] as const;

/** First-run: the owner names their model. Nothing about the name is hard-coded. */
export function CreateModel({ t }: { t: Dict }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // null = still loading; the connection section shows only when the server has no model of its own.
  const [platformConfigured, setPlatformConfigured] = useState<boolean | null>(null);
  const [personal, setPersonal] = useState<ProviderRow[]>([]);
  const [choice, setChoice] = useState<string>("groq");
  const preset = PRESETS.find((p) => p.id === choice);
  const [endpoint, setEndpoint] = useState<string>(PRESETS[0].endpoint);
  const [model, setModel] = useState<string>(PRESETS[0].model);

  useEffect(() => {
    api<{ platformConfigured: boolean; providers: ProviderRow[] }>("/api/ai/providers")
      .then((r) => {
        setPlatformConfigured(r.platformConfigured);
        setPersonal(r.providers.filter((p) => p.scope === "personal"));
      })
      .catch(() => setPlatformConfigured(true));
  }, []);

  function pick(id: string) {
    setChoice(id);
    const p = PRESETS.find((x) => x.id === id);
    if (p) {
      setEndpoint(p.endpoint);
      setModel(p.model);
    }
  }

  async function connect(f: FormData): Promise<{ providerId: string; providerModel: string } | undefined> {
    if (platformConfigured !== false) return undefined;
    const providerModel = model.trim();
    if (!preset) return { providerId: choice, providerModel };
    const created = await api<{ provider: { id: string } }>("/api/ai/providers", {
      body: {
        providerName: `${preset.label} · ${Math.random().toString(36).slice(2, 6)}`,
        providerType: "openai_compatible",
        endpoint: endpoint.trim(),
        apiKey: String(f.get("apiKey") ?? "") || undefined,
      },
    });
    const id = created.provider.id;
    setPersonal((rows) => [...rows, { id, providerName: preset.label, endpoint: endpoint.trim(), scope: "personal" }]);
    setChoice(id);
    const check = await api<{ health: { status: string } }>(`/api/ai/providers/${id}/health`, { body: {} });
    if (check.health.status !== "healthy") throw new Error(t.create.connectFailed);
    return { providerId: id, providerModel };
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const base = await connect(f);
      await api("/api/ai/models/personal", {
        body: {
          displayName: String(f.get("displayName")),
          description: String(f.get("description") ?? ""),
          defaultLanguage: String(f.get("lang")),
          ...(base ?? {}),
        },
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : t.common.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card glass stack" onSubmit={submit} style={{ maxWidth: 560 }}>
      <h2>{t.create.title}</h2>
      <label className="field">
        <span>{t.create.displayName}</span>
        <input className="input" name="displayName" required maxLength={80} placeholder="Saad AI" />
        <span className="hint">{t.create.displayNameHint}</span>
      </label>
      <label className="field">
        <span>{t.create.description}</span>
        <input className="input" name="description" maxLength={2000} />
      </label>
      <label className="field">
        <span>{t.create.language}</span>
        <select className="select" name="lang" defaultValue="ar">
          <option value="ar">العربية</option>
          <option value="en">English</option>
          <option value="auto">Auto</option>
        </select>
      </label>

      {platformConfigured === false && (
        <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
          <h3>{t.create.connectTitle}</h3>
          <p className="hint">{t.create.connectHint}</p>
          <label className="field">
            <span>{t.create.provider}</span>
            <select className="select" value={choice} onChange={(e) => pick(e.target.value)}>
              {personal.map((p) => (
                <option key={p.id} value={p.id}>{p.providerName}</option>
              ))}
              {PRESETS.map((p) => (
                <option key={p.id} value={p.id}>{personal.length ? `${t.create.newConnection}: ${p.label}` : p.label}</option>
              ))}
            </select>
          </label>
          {preset && (
            <>
              <label className="field">
                <span>{t.create.endpoint}</span>
                <input className="input ltr" type="url" required value={endpoint} onChange={(e) => setEndpoint(e.target.value)} placeholder="https://…/v1" />
              </label>
              <label className="field">
                <span>{t.create.apiKey}</span>
                <input className="input ltr" name="apiKey" type="password" required autoComplete="off" maxLength={4096} />
              </label>
            </>
          )}
          <label className="field">
            <span>{t.create.modelName}</span>
            <input className="input ltr" required maxLength={200} value={model} onChange={(e) => setModel(e.target.value)} />
          </label>
        </fieldset>
      )}

      {error && <div className="alert bad">{error}</div>}
      <button className="btn primary" disabled={busy || platformConfigured === null}>
        {busy ? (platformConfigured === false ? t.create.checking : t.common.loading) : t.create.submit}
      </button>
    </form>
  );
}
