"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/client/api";
import type { Dict } from "@/lib/i18n";

const SCOPES = ["chat", "models:read", "knowledge:read", "knowledge:write", "usage:read"] as const;

export function NewApiKey({ t }: { t: Dict }) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  return (
    <form className="stack" onSubmit={async (e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      try {
        const r = await api<{ token: string }>("/api/ai/api-keys", { body: { name: f.get("name"), scopes: SCOPES.filter((s) => f.get(s) === "on"), expiresInDays: f.get("days") ? Number(f.get("days")) : undefined } });
        setToken(r.token);
        router.refresh();
      } catch (er) { setErr(er instanceof ApiError ? er.message : t.common.error); }
    }}>
      <label className="field"><span>{t.datasets.name}</span><input className="input" name="name" required maxLength={80} /></label>
      <div className="field"><span>{t.api.scopes}</span>
        <div className="row">{SCOPES.map((s) => <label key={s} className="check"><input type="checkbox" name={s} defaultChecked={s === "chat"} /><span className="mono ltr small">{s}</span></label>)}</div>
      </div>
      <label className="field"><span>Expires (days)</span><input className="input num ltr" name="days" type="number" min={1} max={365} placeholder="—" /></label>
      {err && <div className="alert bad small">{err}</div>}
      <button className="btn primary">{t.api.newKey}</button>
      {token && (
        <div className="alert warn stack">
          <b>{t.api.tokenOnce}</b>
          <code className="ltr" style={{ wordBreak: "break-all" }}>{token}</code>
          <button type="button" className="btn sm" onClick={() => navigator.clipboard.writeText(token)}>{t.common.copy}</button>
        </div>
      )}
    </form>
  );
}

export function NewProvider({ t }: { t: Dict }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  return (
    <form className="stack" onSubmit={async (e) => {
      e.preventDefault();
      const form = e.currentTarget;
      const f = new FormData(form);
      try {
        await api("/api/ai/providers", { body: { providerName: f.get("name"), providerType: f.get("type"), endpoint: f.get("endpoint"), apiKey: f.get("key") || undefined } });
        form.reset();
        setErr(null);
        router.refresh();
      } catch (er) { setErr(er instanceof ApiError ? er.message : t.common.error); }
    }}>
      <div className="grid grid-2">
        <label className="field"><span>{t.datasets.name}</span><input className="input" name="name" required maxLength={80} /></label>
        <label className="field"><span>Type</span><select className="select" name="type"><option value="openai_compatible">OpenAI-compatible</option><option value="vllm">vLLM</option><option value="huggingface">Hugging Face</option></select></label>
      </div>
      <label className="field"><span>{t.api.endpoint}</span><input className="input ltr" name="endpoint" type="url" required placeholder="https://…/v1" /></label>
      <label className="field"><span>{t.api.apiKey}</span><input className="input ltr" name="key" type="password" autoComplete="off" /></label>
      {err && <div className="alert bad small">{err}</div>}
      <button className="btn">{t.api.addProvider}</button>
    </form>
  );
}
