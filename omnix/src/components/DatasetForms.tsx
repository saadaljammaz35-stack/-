"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { api, ApiError } from "@/lib/client/api";
import type { Dict } from "@/lib/i18n";

export function NewDataset({ t }: { t: Dict }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  return (
    <form className="stack" onSubmit={async (e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      try {
        const r = await api<{ dataset: { id: string } }>("/api/ai/datasets", { body: { name: f.get("name"), description: f.get("description") ?? "", datasetType: "sft_chat" } });
        router.push(`/ai/datasets/${r.dataset.id}`);
      } catch (er) { setErr(er instanceof ApiError ? er.message : t.common.error); }
    }}>
      <label className="field"><span>{t.datasets.name}</span><input className="input" name="name" required maxLength={120} /></label>
      <label className="field"><span>{t.create.description}</span><input className="input" name="description" maxLength={2000} /></label>
      {err && <div className="alert bad small">{err}</div>}
      <button className="btn primary">{t.datasets.create}</button>
    </form>
  );
}

export function DatasetUpload({ t, id }: { t: Dict; id: string }) {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  return (
    <div className="stack">
      <button className="btn" onClick={() => ref.current?.click()}>{t.datasets.uploadJsonl}</button>
      <input ref={ref} type="file" hidden accept=".jsonl,.json,.ndjson" onChange={async (e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        const form = new FormData();
        form.set("file", file);
        try {
          const r = await api<{ added: number; skippedLines: unknown[] }>(`/api/ai/datasets/${id}/upload`, { form });
          setMsg({ text: `+${r.added} ${t.datasets.records}${r.skippedLines.length ? ` · ${r.skippedLines.length} skipped` : ""}` });
          router.refresh();
        } catch (er) { setMsg({ text: er instanceof ApiError ? er.message : t.common.error, bad: true }); }
      }} />
      <p className="tiny muted mono ltr" style={{ margin: 0 }}>{'{"messages":[{"role":"user","content":"…"},{"role":"assistant","content":"…"}]}'}</p>
      {msg && <div className={`alert ${msg.bad ? "bad" : "ok"} small`}>{msg.text}</div>}
    </div>
  );
}

export function RightsForm({ t, id }: { t: Dict; id: string }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  return (
    <form className="stack" onSubmit={async (e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      try {
        await api(`/api/ai/datasets/${id}/rights`, { body: { statement: f.get("statement"), confirm: f.get("confirm") === "on" } });
        router.refresh();
      } catch (er) { setErr(er instanceof ApiError ? er.message : t.common.error); }
    }}>
      <label className="field"><span>{t.datasets.rightsStatement}</span><textarea className="textarea" name="statement" required minLength={10} maxLength={2000} dir="auto" /></label>
      <label className="check"><input type="checkbox" name="confirm" required /><span>{t.datasets.rightsConfirm}</span></label>
      {err && <div className="alert bad small">{err}</div>}
      <button className="btn">{t.datasets.confirmRights}</button>
    </form>
  );
}
