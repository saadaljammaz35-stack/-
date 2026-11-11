"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { api, ApiError } from "@/lib/client/api";
import type { Dict } from "@/lib/i18n";
import * as I from "./icons";

type Result = { documentId: string; title: string; page: number | null; content: string; similarity: number | null; keywordRank: number | null; relevant: boolean };

export function KnowledgeUpload({ t }: { t: Dict }) {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const [tags, setTags] = useState("");

  async function upload(files: FileList | File[]) {
    for (const file of Array.from(files)) {
      const form = new FormData();
      form.set("file", file);
      if (tags) form.set("tags", tags);
      try {
        await api("/api/ai/knowledge/upload", { form });
        setMsg({ text: `${file.name} ✓` });
      } catch (err) {
        setMsg({ text: `${file.name}: ${err instanceof ApiError ? err.message : t.common.error}`, bad: true });
      }
    }
    router.refresh();
  }

  return (
    <div className="stack">
      <div
        className={`dropzone ${drag ? "active" : ""}`}
        role="button"
        tabIndex={0}
        onClick={() => ref.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && ref.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); void upload(e.dataTransfer.files); }}
      >
        <I.IconUpload style={{ width: 28, height: 28 }} />
        <div>{t.knowledge.drop}</div>
        <div className="tiny">≤ 25 MB</div>
        <input ref={ref} type="file" hidden multiple accept=".pdf,.docx,.txt,.md,.markdown,.json,.jsonl,.ndjson" onChange={(e) => e.target.files && void upload(e.target.files)} />
      </div>
      <label className="field"><span>{t.knowledge.tags}</span><input className="input" value={tags} onChange={(e) => setTags(e.target.value)} /></label>
      {msg && <div className={`alert ${msg.bad ? "bad" : "ok"} small`}>{msg.text}</div>}
    </div>
  );
}

export function KnowledgeText({ t }: { t: Dict }) {
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
          await api("/api/ai/knowledge/text", { body: { title: f.get("title"), text: f.get("text"), tags: String(f.get("tags") ?? "").split(",").map((x) => x.trim()).filter(Boolean) } });
          form.reset();
          setErr(null);
          router.refresh();
        } catch (er) {
          setErr(er instanceof ApiError ? er.message : t.common.error);
        }
      }}
    >
      <label className="field"><span>{t.knowledge.titleField}</span><input className="input" name="title" required maxLength={200} /></label>
      <label className="field"><span>{t.knowledge.textField}</span><textarea className="textarea" name="text" required dir="auto" /></label>
      <label className="field"><span>{t.knowledge.tags}</span><input className="input" name="tags" /></label>
      {err && <div className="alert bad small">{err}</div>}
      <button className="btn">{t.knowledge.addText}</button>
    </form>
  );
}

export function KnowledgeSearch({ t }: { t: Dict }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[] | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="stack">
      <form className="row" onSubmit={async (e) => {
        e.preventDefault();
        if (!q.trim()) return;
        setBusy(true);
        try {
          setResults((await api<{ results: Result[] }>("/api/ai/knowledge/search", { body: { query: q, topK: 6 } })).results);
        } finally {
          setBusy(false);
        }
      }}>
        <input className="input" style={{ flex: 1 }} dir="auto" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.knowledge.searchPlaceholder} />
        <button className="btn primary" disabled={busy}>{t.common.search}</button>
      </form>
      {results && (results.length === 0 ? <div className="muted small">{t.common.none}</div> : (
        <div className="list">
          {results.map((r, i) => (
            <div key={i} className="list-item" style={{ alignItems: "flex-start" }}>
              <div className="grow">
                <div className="row">
                  <strong>{r.title}</strong>
                  {r.page && <span className="muted small">{t.chat.page} {r.page}</span>}
                  <span className={`badge ${r.relevant ? "ok" : ""}`}>{r.relevant ? t.knowledge.relevant : t.knowledge.notRelevant}</span>
                  <span className="tiny muted num ltr">cos {r.similarity?.toFixed(3) ?? "—"}{r.keywordRank ? ` · kw #${r.keywordRank}` : ""}</span>
                </div>
                <p className="small" style={{ margin: "6px 0 0" }} dir="auto">{r.content.slice(0, 360)}{r.content.length > 360 ? "…" : ""}</p>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
