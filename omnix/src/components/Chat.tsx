"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError, postSse } from "@/lib/client/api";
import type { Dict } from "@/lib/i18n";
import * as I from "./icons";

export interface SourceRef { id: string; title: string; page: number | null; snippet: string; cited?: boolean }
export interface UiMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  status: "complete" | "streaming" | "cancelled" | "error";
  sources: SourceRef[];
  version?: string | null;
  usage?: { inputTokens?: number; outputTokens?: number; source?: string; latencyMs?: number } | null;
  rating?: number | null;
  error?: string;
  memoriesUsed?: number;
}
interface Props {
  t: Dict;
  model: { id: string; displayName: string; versions: { id: string; version: string; status: string; adapterName: string | null }[] };
  conversations: { id: string; title: string }[];
  datasets: { id: string; name: string }[];
  conversationId: string | null;
  initial: UiMessage[];
}

export function Chat({ t, model, conversations, datasets, conversationId: initialConv, initial }: Props) {
  const router = useRouter();
  const [messages, setMessages] = useState<UiMessage[]>(initial);
  const [conversationId, setConversationId] = useState(initialConv);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [versionId, setVersionId] = useState<string>("");
  const [toast, setToast] = useState<{ text: string; bad?: boolean } | null>(null);
  const [sideOpen, setSideOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const deployed = model.versions.find((v) => v.status === "deployed");
  const selected = model.versions.find((v) => v.id === versionId) ?? deployed ?? model.versions.find((v) => v.status === "ready");
  const preview = selected?.status !== "deployed";

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages]);
  useEffect(() => {
    if (!toast) return;
    const h = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(h);
  }, [toast]);

  const patch = (id: string, f: (m: UiMessage) => UiMessage) => setMessages((ms) => ms.map((m) => (m.id === id ? f(m) : m)));

  const run = useCallback(
    async (body: Record<string, unknown>, userText: string | null) => {
      const ac = new AbortController();
      abortRef.current = ac;
      setBusy(true);
      const tempUser = `u-${Date.now()}`;
      const tempAssistant = `a-${Date.now()}`;
      setMessages((ms) => [
        ...ms,
        ...(userText ? [{ id: tempUser, role: "user" as const, content: userText, status: "complete" as const, sources: [] }] : []),
        { id: tempAssistant, role: "assistant", content: "", status: "streaming", sources: [] },
      ]);
      let assistantId = tempAssistant;
      try {
        await postSse(
          "/api/ai/chat/stream",
          { ...body, ...(versionId ? { modelVersionId: versionId } : {}) },
          ({ event, data }) => {
            if (event === "meta") {
              const d = data as { conversationId: string; userMessageId: string; assistantMessageId: string; model: { version: string }; sources: SourceRef[]; memoriesUsed: number };
              if (!conversationId) {
                setConversationId(d.conversationId);
                window.history.replaceState(null, "", `/ai/chat/${d.conversationId}`);
              }
              assistantId = d.assistantMessageId;
              setMessages((ms) =>
                ms.map((m) =>
                  m.id === tempAssistant
                    ? { ...m, id: d.assistantMessageId, version: d.model.version, sources: d.sources, memoriesUsed: d.memoriesUsed }
                    : m.id === tempUser
                      ? { ...m, id: d.userMessageId }
                      : m,
                ),
              );
            } else if (event === "delta") {
              patch(assistantId, (m) => ({ ...m, content: m.content + String(data.text ?? "") }));
            } else if (event === "done") {
              const msg = (data as { message: { content: string; status: UiMessage["status"]; cited: string[]; usage: UiMessage["usage"]; latencyMs: number } }).message;
              patch(assistantId, (m) => ({
                ...m,
                content: msg.content,
                status: msg.status,
                usage: { ...msg.usage, latencyMs: msg.latencyMs },
                sources: m.sources.map((s) => ({ ...s, cited: msg.cited.includes(s.id) })),
              }));
            } else if (event === "error") {
              patch(assistantId, (m) => ({ ...m, status: "error", error: String(data.message ?? t.chat.failed) }));
            }
          },
          ac.signal,
        );
      } catch (err) {
        if (ac.signal.aborted) patch(assistantId, (m) => ({ ...m, status: "cancelled" }));
        else patch(assistantId, (m) => ({ ...m, status: "error", error: err instanceof ApiError ? err.message : t.chat.failed }));
      } finally {
        setBusy(false);
        abortRef.current = null;
        router.refresh();
      }
    },
    [conversationId, versionId, router, t.chat.failed],
  );

  const send = () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    void run({ message: text, ...(conversationId ? { conversationId } : { modelProfileId: model.id }) }, text);
  };
  const regenerate = (assistantId: string) => {
    if (busy || !conversationId) return;
    void run({ conversationId, regenerateMessageId: assistantId }, null);
  };
  const rate = async (m: UiMessage, rating: 1 | -1) => {
    const next = m.rating === rating ? null : rating;
    patch(m.id, (x) => ({ ...x, rating: next }));
    await api(`/api/ai/messages/${m.id}/feedback`, { body: { rating: next } }).catch(() => setToast({ text: t.common.error, bad: true }));
  };
  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setToast({ text: t.common.copied });
  };
  const toDataset = async (m: UiMessage) => {
    if (!datasets.length) return router.push("/ai/datasets");
    if (!window.confirm(t.chat.toDatasetConfirm)) return;
    try {
      await api("/api/ai/datasets/from-message", { body: { datasetId: datasets[0]!.id, assistantMessageId: m.id, consent: true } });
      setToast({ text: `${t.common.saved} → ${datasets[0]!.name}` });
    } catch (err) {
      setToast({ text: err instanceof ApiError ? err.message : t.common.error, bad: true });
    }
  };
  const remember = async (m: UiMessage) => {
    try {
      await api("/api/ai/memory", { body: { kind: "fact", content: m.content.slice(0, 2000), modelProfileId: model.id } });
      setToast({ text: t.common.saved });
    } catch (err) {
      setToast({ text: err instanceof ApiError ? err.message : t.common.error, bad: true });
    }
  };
  const attach = async (file: File) => {
    const form = new FormData();
    form.set("file", file);
    try {
      await api("/api/ai/knowledge/upload", { form });
      setToast({ text: `${file.name} → ${t.nav.knowledge}` });
    } catch (err) {
      setToast({ text: err instanceof ApiError ? err.message : t.common.error, bad: true });
    }
  };
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");

  return (
    <div className="chat">
      <aside className={`chat-side card flat ${sideOpen ? "open" : ""}`}>
        <div className="row between">
          <Link className="btn primary sm" href="/ai/chat" onClick={() => { setSideOpen(false); setMessages([]); setConversationId(null); }}>
            <I.IconPlus /> {t.chat.newChat}
          </Link>
          {sideOpen && <button className="btn sm ghost" onClick={() => setSideOpen(false)}>{t.common.back}</button>}
        </div>
        <div className="tiny muted">{t.chat.history}</div>
        <div className="list">
          {conversations.map((c) => (
            <Link key={c.id} className="conv truncate" href={`/ai/chat/${c.id}`} aria-current={c.id === conversationId} onClick={() => setSideOpen(false)} dir="auto">
              {c.title || "…"}
            </Link>
          ))}
          {!conversations.length && <span className="muted small">{t.common.none}</span>}
        </div>
      </aside>

      <section className="chat-main card">
        <header className="chat-head">
          <button className="btn sm ghost show-tablet" onClick={() => setSideOpen(true)} aria-label={t.chat.history}><I.IconChat /></button>
          <strong>{model.displayName}</strong>
          {preview ? <span className="badge warn">{t.chat.preview}</span> : <span className="badge ok">live</span>}
          <span className="spacer" />
          <label className="row small muted">
            {t.chat.version}
            <select className="select" style={{ width: "auto", padding: "4px 8px" }} value={versionId} onChange={(e) => setVersionId(e.target.value)} disabled={busy}>
              <option value="">{deployed ? `${deployed.version} (deployed)` : "auto"}</option>
              {model.versions.filter((v) => v.status === "ready" || v.status === "deployed").map((v) => (
                <option key={v.id} value={v.id}>{v.version}{v.adapterName ? " · LoRA" : ""}{v.status === "deployed" ? " ✓" : ""}</option>
              ))}
            </select>
          </label>
        </header>

        <div className="chat-log" ref={logRef} aria-live="polite">
          {messages.length === 0 && <div className="empty"><I.IconChat /><div>{t.chat.empty}</div></div>}
          {messages.map((m) => (
            <div key={m.id} className={`msg ${m.role}`}>
              <div className={`bubble ${m.status === "streaming" ? "cursor" : ""}`} dir="auto">
                {m.content || (m.status === "streaming" ? "" : m.status === "error" ? "" : "…")}
              </div>
              {m.status === "error" && <div className="alert bad small">{m.error ?? t.chat.failed}</div>}
              {m.role === "assistant" && m.sources.length > 0 && (
                <div className="sources" aria-label={t.chat.sources}>
                  {m.sources.map((s) => (
                    <span key={s.id} className="source truncate" title={s.snippet} style={s.cited ? { borderColor: "var(--accent)" } : undefined}>
                      <b>{s.id}</b> {s.title}{s.page ? ` · ${t.chat.page} ${s.page}` : ""}
                    </span>
                  ))}
                </div>
              )}
              {m.status !== "streaming" && (
                <div className="meta">
                  {m.role === "assistant" ? (
                    <>
                      {m.status === "cancelled" && <span className="badge warn">{t.chat.cancelled}</span>}
                      {m.version && <span>v{m.version}</span>}
                      {m.usage?.outputTokens !== undefined && <span className="num">· {m.usage.outputTokens} {t.chat.tokens}{m.usage.source === "estimate" ? " ~" : ""}</span>}
                      {m.usage?.latencyMs !== undefined && <span className="num">· {(m.usage.latencyMs / 1000).toFixed(1)}s</span>}
                      {!!m.memoriesUsed && <span>· {m.memoriesUsed} {t.chat.memories}</span>}
                      <button className="btn icon sm ghost" onClick={() => copy(m.content)} title={t.common.copy} aria-label={t.common.copy}><I.IconCopy /></button>
                      <button className="btn icon sm ghost" onClick={() => rate(m, 1)} title={t.chat.rateUp} aria-pressed={m.rating === 1} style={m.rating === 1 ? { color: "var(--ok)" } : undefined}><I.IconThumbUp /></button>
                      <button className="btn icon sm ghost" onClick={() => rate(m, -1)} title={t.chat.rateDown} aria-pressed={m.rating === -1} style={m.rating === -1 ? { color: "var(--bad)" } : undefined}><I.IconThumbDown /></button>
                      {m.id === lastAssistant?.id && conversationId && (
                        <button className="btn icon sm ghost" onClick={() => regenerate(m.id)} disabled={busy} title={t.chat.regenerate} aria-label={t.chat.regenerate}><I.IconRefresh /></button>
                      )}
                      {m.status === "complete" && <button className="btn sm ghost" onClick={() => toDataset(m)}>{t.chat.toDataset}</button>}
                    </>
                  ) : (
                    <button className="btn sm ghost" onClick={() => remember(m)}>{t.chat.remember}</button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <form className="composer" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <input ref={fileRef} type="file" hidden accept=".pdf,.docx,.txt,.md,.json,.jsonl" onChange={(e) => { const f = e.target.files?.[0]; if (f) void attach(f); e.target.value = ""; }} />
          <button type="button" className="btn icon ghost" onClick={() => fileRef.current?.click()} title={t.chat.attach} aria-label={t.chat.attach}><I.IconUpload /></button>
          <textarea
            dir="auto"
            rows={1}
            value={input}
            placeholder={t.chat.placeholder}
            aria-label={t.chat.placeholder}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send();
              }
            }}
          />
          {busy ? (
            <button type="button" className="btn icon" onClick={() => abortRef.current?.abort()} title={t.chat.stop} aria-label={t.chat.stop}><I.IconStop /></button>
          ) : (
            <button className="btn icon primary" disabled={!input.trim()} title={t.chat.send} aria-label={t.chat.send}><I.IconSend /></button>
          )}
        </form>
      </section>
      {toast && <div className={`toast ${toast.bad ? "bad" : ""}`} role="status">{toast.text}</div>}
    </div>
  );
}
