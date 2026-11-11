"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/client/api";
import type { Dict } from "@/lib/i18n";

/** First-run: the owner names their model. Nothing about the name is hard-coded. */
export function CreateModel({ t }: { t: Dict }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await api("/api/ai/models/personal", {
        body: { displayName: String(f.get("displayName")), description: String(f.get("description") ?? ""), defaultLanguage: String(f.get("lang")) },
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.common.error);
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
      {error && <div className="alert bad">{error}</div>}
      <button className="btn primary" disabled={busy}>{busy ? t.common.loading : t.create.submit}</button>
    </form>
  );
}
