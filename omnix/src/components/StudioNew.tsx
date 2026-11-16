"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/client/api";
import { connectProvider, loadProviders, PROVIDER_PRESETS, type ProviderRow } from "@/lib/client/connect";
import type { Dict } from "@/lib/i18n";
import * as I from "./icons";

/**
 * The studio's front door, Replit-style: one box — "what do you want to
 * build?". On the very first run it also creates the owner's model, and if
 * the server has no model of its own it asks once for a provider key.
 */
export function StudioNew({ t, hasModel, ownerName }: { t: Dict; hasModel: boolean; ownerName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // null while loading; only matters when there is no model yet.
  const [needsKey, setNeedsKey] = useState<boolean | null>(hasModel ? false : null);
  const [personal, setPersonal] = useState<ProviderRow[]>([]);
  const [choice, setChoice] = useState<string>("groq");
  const [endpoint, setEndpoint] = useState<string>(PROVIDER_PRESETS[0].endpoint);
  const [model, setModel] = useState<string>(PROVIDER_PRESETS[0].model);
  const preset = PROVIDER_PRESETS.find((p) => p.id === choice);

  useEffect(() => {
    if (hasModel) return;
    loadProviders()
      .then((r) => {
        setPersonal(r.personal);
        if (r.personal[0]) setChoice(r.personal[0].id);
        setNeedsKey(!r.platformConfigured);
      })
      .catch(() => setNeedsKey(false));
  }, [hasModel]);

  function pick(id: string) {
    setChoice(id);
    const p = PROVIDER_PRESETS.find((x) => x.id === id);
    if (p) {
      setEndpoint(p.endpoint);
      setModel(p.model);
    }
  }

  async function ensureModel(f: FormData): Promise<void> {
    if (hasModel) return;
    let base: { providerId: string; providerModel: string } | undefined;
    if (needsKey) {
      const providerId = preset ? await connectProvider(t, preset, endpoint, String(f.get("apiKey") ?? "")) : choice;
      base = { providerId, providerModel: model.trim() };
    }
    try {
      await api("/api/ai/models/personal", {
        body: { displayName: `${ownerName || "OMNIX"} AI`.slice(0, 80), defaultLanguage: "ar", ...(base ?? {}) },
      });
    } catch (err) {
      // Created on an earlier attempt (e.g. the app step failed): carry on.
      if (!(err instanceof ApiError && err.code === "CONFLICT")) throw err;
    }
  }

  return (
    <form
      className="studio-start stack"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const idea = String(f.get("idea") ?? "").trim();
        if (!idea) return;
        const name = idea.split(/\s+/).slice(0, 6).join(" ").slice(0, 60) || t.studio.namePlaceholder;
        setBusy(true);
        setError(null);
        try {
          await ensureModel(f);
          const r = await api<{ app: { id: string } }>("/api/ai/apps", { body: { name, description: idea } });
          router.push(`/ai/studio/${r.app.id}?start=1`);
        } catch (err) {
          setError(err instanceof Error ? err.message : t.common.error);
          setBusy(false);
        }
      }}
    >
      <h2 className="studio-start-title">{t.studio.startTitle}</h2>
      <p className="muted">{t.studio.startHint}</p>
      <textarea className="textarea studio-idea" name="idea" required maxLength={2000} dir="auto" placeholder={t.studio.ideaPlaceholder} />

      {needsKey && (
        <fieldset className="studio-connect stack">
          <strong>{t.studio.connectOnce}</strong>
          <span className="small muted">{t.studio.connectOnceHint}</span>
          <label className="field">
            <span>{t.create.provider}</span>
            <select className="select" value={choice} onChange={(e) => pick(e.target.value)}>
              {personal.map((p) => <option key={p.id} value={p.id}>{p.providerName}</option>)}
              {PROVIDER_PRESETS.map((p) => <option key={p.id} value={p.id}>{personal.length ? `${t.create.newConnection}: ${p.label}` : p.label}</option>)}
            </select>
          </label>
          {preset && (
            <>
              {preset.keyUrl && (
                <div className="small">
                  <a className="btn sm" href={preset.keyUrl} target="_blank" rel="noopener noreferrer"><I.IconGlobe /> {t.create.getKey} — {preset.label}</a>
                  <div className="muted" style={{ marginTop: 6 }}>{t.studio.keySteps}</div>
                </div>
              )}
              <label className="field">
                <span>{t.create.apiKey}</span>
                <input className="input ltr" name="apiKey" type="password" required autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false} maxLength={4096} placeholder={preset.keyPrefix ? `${preset.keyPrefix}…` : ""} />
              </label>
              {preset.id === "custom" && (
                <label className="field">
                  <span>{t.create.endpoint}</span>
                  <input className="input ltr" type="url" required value={endpoint} onChange={(e) => setEndpoint(e.target.value)} placeholder="https://…/v1" />
                </label>
              )}
            </>
          )}
          <details>
            <summary className="small muted">{t.create.modelName}</summary>
            <input className="input ltr" required maxLength={200} value={model} onChange={(e) => setModel(e.target.value)} aria-label={t.create.modelName} />
          </details>
        </fieldset>
      )}

      {error && <div className="alert bad small" role="alert">{error}</div>}
      <button className="btn primary studio-go" disabled={busy || needsKey === null}>
        <I.IconWand /> {busy ? t.common.loading : t.studio.create}
      </button>
      <p className="hint small">{t.studio.limitsNote}</p>
    </form>
  );
}
