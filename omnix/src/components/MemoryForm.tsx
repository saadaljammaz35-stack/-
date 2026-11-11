"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/client/api";
import type { Dict } from "@/lib/i18n";

export function MemoryForm({ t, modelId }: { t: Dict; modelId: string | null }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const f = new FormData(form);
        try {
          await api("/api/ai/memory", { body: { kind: f.get("kind"), content: f.get("content"), modelProfileId: f.get("scope") === "model" ? modelId : null } });
          form.reset();
          setErr(null);
          router.refresh();
        } catch (er) {
          setErr(er instanceof ApiError ? er.message : t.common.error);
        }
      }}
    >
      <div className="grid grid-2">
        <label className="field"><span>{t.memory.kind}</span>
          <select className="select" name="kind" defaultValue="preference">
            <option value="preference">{t.memory.preference}</option>
            <option value="fact">{t.memory.fact}</option>
            <option value="project">{t.memory.project}</option>
          </select>
        </label>
        <label className="field"><span>Scope</span>
          <select className="select" name="scope" defaultValue="model">
            <option value="model">{t.nav.model}</option>
            <option value="all">All models</option>
          </select>
        </label>
      </div>
      <label className="field"><span>{t.memory.content}</span><textarea className="textarea" name="content" required maxLength={2000} dir="auto" /></label>
      <p className="tiny muted" style={{ margin: 0 }}>{t.memory.rule}</p>
      {err && <div className="alert bad small">{err}</div>}
      <button className="btn primary">{t.memory.add}</button>
    </form>
  );
}
