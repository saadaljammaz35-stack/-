"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/client/api";
import type { Dict } from "@/lib/i18n";

/** Starts a project from an idea; the studio then sends the idea as its first request. */
export function StudioNew({ t }: { t: Dict }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const idea = String(f.get("idea") ?? "").trim();
        const name = String(f.get("name") ?? "").trim() || idea.split(/\s+/).slice(0, 6).join(" ").slice(0, 60) || t.studio.namePlaceholder;
        if (!idea) return;
        setBusy(true);
        setError(null);
        try {
          const r = await api<{ app: { id: string } }>("/api/ai/apps", { body: { name, description: idea } });
          router.push(`/ai/studio/${r.app.id}?start=1`);
        } catch (err) {
          setError(err instanceof ApiError ? err.message : t.common.error);
          setBusy(false);
        }
      }}
    >
      <label className="field">
        <span>{t.studio.ideaLabel}</span>
        <textarea className="textarea" name="idea" required maxLength={2000} dir="auto" placeholder={t.studio.ideaPlaceholder} />
      </label>
      <label className="field">
        <span>{t.datasets.name}</span>
        <input className="input" name="name" maxLength={120} dir="auto" placeholder={t.studio.namePlaceholder} />
      </label>
      {error && <div className="alert bad small">{error}</div>}
      <button className="btn primary" disabled={busy}>{busy ? t.common.loading : t.studio.create}</button>
    </form>
  );
}
