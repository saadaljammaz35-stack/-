"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError, postSse } from "@/lib/client/api";
import type { Dict } from "@/lib/i18n";
import * as I from "./icons";

type Files = Record<string, string>;
interface Project { id: string; name: string; description: string; currentVersionId: string | null; publishedSlug: string | null; publishedVersionId: string | null }
interface VersionMeta { id: string; versionNo: number; summary: string; source: string; createdAt: string; fileCount: number }
interface ServerMessage { id: string; role: "user" | "assistant"; content: string; status: "complete" | "cancelled" | "error"; versionId: string | null }
interface Detail { project: Project; versions: VersionMeta[]; messages: ServerMessage[]; files: Files; previewUrl: string | null }

interface UiMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  status: "complete" | "streaming" | "cancelled" | "error";
  files: { path: string; status: "writing" | "done" | "deleted" }[];
  warnings: string[];
  versionNo?: number | null;
  error?: string;
}

type Tab = "chat" | "preview" | "code";

function fromServer(m: ServerMessage, versions: VersionMeta[]): UiMessage {
  return {
    id: m.id,
    role: m.role,
    content: m.content,
    status: m.status,
    files: [],
    warnings: [],
    versionNo: m.versionId ? (versions.find((v) => v.id === m.versionId)?.versionNo ?? null) : null,
  };
}

export function StudioWorkspace({ t, initial, autoStart }: { t: Dict; initial: Detail; autoStart: boolean }) {
  const router = useRouter();
  const [detail, setDetail] = useState<Detail>(initial);
  const [messages, setMessages] = useState<UiMessage[]>(() => initial.messages.map((m) => fromServer(m, initial.versions)));
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>(initial.previewUrl ? "preview" : "chat");
  const [view, setView] = useState<{ versionId: string | null; files: Files; previewUrl: string | null }>({
    versionId: initial.project.currentVersionId,
    files: initial.files,
    previewUrl: initial.previewUrl,
  });
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [frameKey, setFrameKey] = useState(0);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; bad?: boolean } | null>(null);
  const [origin, setOrigin] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const started = useRef(false);

  const { project, versions } = detail;
  const isCurrent = view.versionId === project.currentVersionId;
  const viewNo = versions.find((v) => v.id === view.versionId)?.versionNo ?? null;
  const publicUrl = project.publishedSlug ? `${origin}/p/${project.publishedSlug}` : null;
  const paths = useMemo(() => Object.keys(view.files).sort(), [view.files]);
  const shownFile = selectedFile && selectedFile in view.files ? selectedFile : (paths.includes("index.html") ? "index.html" : paths[0] ?? null);

  useEffect(() => setOrigin(window.location.origin), []);
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages]);
  useEffect(() => {
    if (!toast) return;
    const h = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(h);
  }, [toast]);
  // Runtime errors from the sandboxed preview (sent by the shim the server injects).
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frameRef.current?.contentWindow) return;
      const d = e.data as { type?: string; message?: string } | null;
      if (d?.type === "omnix-preview-error" && typeof d.message === "string") setPreviewError(d.message.slice(0, 500));
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const patch = (id: string, f: (m: UiMessage) => UiMessage) => setMessages((ms) => ms.map((m) => (m.id === id ? f(m) : m)));

  const reload = useCallback(async () => {
    const d = await api<Detail>(`/api/ai/apps/${project.id}`);
    setDetail(d);
    setView({ versionId: d.project.currentVersionId, files: d.files, previewUrl: d.previewUrl });
    setPreviewError(null);
    setFrameKey((k) => k + 1);
    return d;
  }, [project.id]);

  const send = useCallback(
    async (text: string) => {
      if (!text.trim() || busy) return;
      const ac = new AbortController();
      abortRef.current = ac;
      setBusy(true);
      setPreviewError(null);
      const tempUser = `u-${Date.now()}`;
      const tempAssistant = `a-${Date.now()}`;
      setMessages((ms) => [
        ...ms,
        { id: tempUser, role: "user", content: text, status: "complete", files: [], warnings: [] },
        { id: tempAssistant, role: "assistant", content: "", status: "streaming", files: [], warnings: [] },
      ]);
      let built = false;
      try {
        await postSse(
          `/api/ai/apps/${project.id}/generate`,
          { message: text },
          ({ event, data }) => {
            if (event === "meta") {
              patch(tempUser, (m) => ({ ...m, id: String(data.userMessageId ?? tempUser) }));
            } else if (event === "delta") {
              patch(tempAssistant, (m) => ({ ...m, content: m.content + String(data.text ?? "") }));
            } else if (event === "file") {
              const path = String(data.path);
              const status = data.status as UiMessage["files"][number]["status"];
              patch(tempAssistant, (m) => ({
                ...m,
                files: m.files.some((f) => f.path === path) ? m.files.map((f) => (f.path === path ? { path, status } : f)) : [...m.files, { path, status }],
              }));
            } else if (event === "warning") {
              patch(tempAssistant, (m) => ({ ...m, warnings: [...m.warnings, String(data.message ?? "")] }));
            } else if (event === "done") {
              const d = data as { message: ServerMessage; version: { id: string; versionNo: number } | null };
              built = Boolean(d.version);
              patch(tempAssistant, (m) => ({ ...m, id: d.message.id, content: d.message.content, status: d.message.status, versionNo: d.version?.versionNo ?? null }));
            } else if (event === "error") {
              patch(tempAssistant, (m) => ({ ...m, status: "error", error: String(data.message ?? t.studio.failed) }));
            }
          },
          ac.signal,
        );
      } catch (err) {
        if (ac.signal.aborted) patch(tempAssistant, (m) => ({ ...m, status: "cancelled" }));
        else patch(tempAssistant, (m) => ({ ...m, status: "error", error: err instanceof ApiError ? err.message : t.studio.failed }));
      } finally {
        setBusy(false);
        abortRef.current = null;
        if (built) {
          await reload().catch(() => undefined);
          setTab((cur) => (cur === "chat" && window.matchMedia("(max-width: 900px)").matches ? "preview" : cur));
        }
      }
    },
    [busy, project.id, reload, t.studio.failed],
  );

  // First visit from "Start building": the idea becomes the first request.
  useEffect(() => {
    if (!autoStart || started.current) return;
    started.current = true;
    window.history.replaceState(null, "", `/ai/studio/${project.id}`);
    if (initial.messages.length === 0 && project.description) {
      setTab("chat");
      void send(project.description);
    }
  }, [autoStart, initial.messages.length, project.description, project.id, send]);

  const submit = () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    void send(text);
  };

  const pickVersion = async (versionId: string) => {
    if (versionId === view.versionId) return;
    try {
      const r = await api<{ versionId: string; files: Files; previewUrl: string | null }>(`/api/ai/apps/${project.id}/versions/${versionId}`);
      setView({ versionId: r.versionId, files: r.files, previewUrl: r.previewUrl });
      setPreviewError(null);
      setFrameKey((k) => k + 1);
    } catch (err) {
      setToast({ text: err instanceof ApiError ? err.message : t.common.error, bad: true });
    }
  };

  const restore = async () => {
    if (!view.versionId) return;
    try {
      await api(`/api/ai/apps/${project.id}/restore`, { body: { versionId: view.versionId } });
      await reload();
      setToast({ text: t.common.saved });
    } catch (err) {
      setToast({ text: err instanceof ApiError ? err.message : t.common.error, bad: true });
    }
  };

  const publish = async () => {
    try {
      await api(`/api/ai/apps/${project.id}/publish`, { body: view.versionId ? { versionId: view.versionId } : {} });
      await reload();
      setToast({ text: t.studio.published });
    } catch (err) {
      setToast({ text: err instanceof ApiError ? err.message : t.common.error, bad: true });
    }
  };

  const unpublish = async () => {
    try {
      await api(`/api/ai/apps/${project.id}/publish`, { method: "DELETE" });
      await reload();
    } catch (err) {
      setToast({ text: err instanceof ApiError ? err.message : t.common.error, bad: true });
    }
  };

  const remove = async () => {
    if (!window.confirm(t.common.confirmDelete)) return;
    try {
      await api(`/api/ai/apps/${project.id}`, { method: "DELETE" });
      router.push("/ai/studio");
      router.refresh();
    } catch (err) {
      setToast({ text: err instanceof ApiError ? err.message : t.common.error, bad: true });
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setToast({ text: t.common.copied });
    } catch {
      setToast({ text: text });
    }
  };

  const fixError = () => {
    if (!previewError || busy) return;
    const msg = `${t.studio.previewError}:\n${previewError}\n\n${t.studio.fixIt}.`;
    setTab("chat");
    void send(msg);
  };

  return (
    <div className="studio">
      <header className="studio-head">
        <Link href="/ai/studio" className="btn icon sm ghost" aria-label={t.common.back}>‹</Link>
        <strong className="truncate" dir="auto">{project.name}</strong>
        {versions.length > 0 && (
          <select className="select studio-select" value={view.versionId ?? ""} onChange={(e) => void pickVersion(e.target.value)} disabled={busy} aria-label={t.studio.version}>
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                {t.studio.version} {v.versionNo}{v.id === project.currentVersionId ? " ✓" : ""}{v.id === project.publishedVersionId ? " · 🌐" : ""}
              </option>
            ))}
          </select>
        )}
        <span className="spacer" />
        {!isCurrent && view.versionId && <button className="btn sm" onClick={() => void restore()} disabled={busy}>{t.studio.restore}</button>}
        {view.versionId && (
          <button className="btn sm primary" onClick={() => void publish()} disabled={busy}>
            {project.publishedSlug ? t.studio.republish : t.studio.publish}
          </button>
        )}
        <button className="btn icon sm ghost danger" onClick={() => void remove()} title={t.studio.deleteApp} aria-label={t.studio.deleteApp}><I.IconTrash /></button>
      </header>

      {publicUrl && (
        <div className="studio-public">
          <span className="badge ok">{t.studio.published}</span>
          <a className="mono ltr truncate" href={publicUrl} target="_blank" rel="noopener noreferrer">{publicUrl}</a>
          <button className="btn sm ghost" onClick={() => void copy(publicUrl)}><I.IconCopy /> {t.studio.copyLink}</button>
          <button className="btn sm ghost danger" onClick={() => void unpublish()}>{t.studio.unpublish}</button>
        </div>
      )}

      <div className="segmented studio-tabs">
        {(["chat", "preview", "code"] as const).map((k) => (
          <button key={k} aria-pressed={tab === k} onClick={() => setTab(k)}>
            {k === "chat" ? t.studio.chatTab : k === "preview" ? t.studio.previewTab : t.studio.codeTab}
          </button>
        ))}
      </div>

      <div className="studio-body">
        <section className={`studio-chat card ${tab === "chat" ? "on" : ""}`}>
          <div className="chat-log" ref={logRef} aria-live="polite">
            {messages.length === 0 && <div className="empty"><I.IconWand /><div>{t.studio.noPreview}</div></div>}
            {messages.map((m) => (
              <div key={m.id} className={`msg ${m.role}`}>
                <div className={`bubble ${m.status === "streaming" ? "cursor" : ""}`} dir="auto">
                  {m.content || (m.status === "streaming" ? "" : m.status === "error" ? "" : "…")}
                </div>
                {m.files.length > 0 && (
                  <div className="studio-files">
                    {m.files.map((f) => (
                      <span key={f.path} className={`studio-file ${f.status}`}>
                        <span className="mono ltr">{f.path}</span>
                        <span className="tiny">{f.status === "writing" ? t.studio.writing : f.status === "deleted" ? t.studio.deletedFile : t.studio.written}</span>
                      </span>
                    ))}
                  </div>
                )}
                {m.warnings.map((w, i) => <div key={i} className="alert warn small">{w}</div>)}
                {m.status === "error" && <div className="alert bad small">{m.error ?? t.studio.failed}</div>}
                {m.status === "cancelled" && <div className="meta"><span className="badge warn">{t.chat.cancelled}</span></div>}
                {m.role === "assistant" && m.status !== "streaming" && m.versionNo ? (
                  <div className="meta"><span className="badge accent plain">{t.studio.built} · {t.studio.version} {m.versionNo}</span></div>
                ) : null}
              </div>
            ))}
          </div>
          <form className="composer" onSubmit={(e) => { e.preventDefault(); submit(); }}>
            <textarea
              dir="auto"
              rows={1}
              value={input}
              placeholder={t.studio.placeholder}
              aria-label={t.studio.placeholder}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  submit();
                }
              }}
            />
            {busy ? (
              <button type="button" className="btn icon" onClick={() => abortRef.current?.abort()} title={t.studio.stop} aria-label={t.studio.stop}><I.IconStop /></button>
            ) : (
              <button className="btn icon primary" disabled={!input.trim()} title={t.studio.send} aria-label={t.studio.send}><I.IconSend /></button>
            )}
          </form>
        </section>

        <section className={`studio-view card ${tab !== "chat" ? "on" : ""}`}>
          <div className="studio-view-head">
            <div className="segmented studio-view-tabs">
              <button aria-pressed={tab !== "code"} onClick={() => setTab("preview")}>{t.studio.previewTab}</button>
              <button aria-pressed={tab === "code"} onClick={() => setTab("code")}>{t.studio.codeTab}</button>
            </div>
            {viewNo && <span className="small muted">{t.studio.version} {viewNo}</span>}
            <span className="spacer" />
            {view.previewUrl && tab !== "code" && (
              <>
                <button className="btn icon sm ghost" onClick={() => { setPreviewError(null); setFrameKey((k) => k + 1); }} title={t.studio.reload} aria-label={t.studio.reload}><I.IconRefresh /></button>
                <a className="btn sm ghost" href={view.previewUrl} target="_blank" rel="noopener noreferrer">{t.studio.openTab}</a>
              </>
            )}
          </div>

          {tab !== "code" ? (
            view.previewUrl ? (
              <div className="studio-frame-wrap">
                {previewError && (
                  <div className="alert bad small studio-error">
                    <div><b>{t.studio.previewError}:</b> <span className="mono ltr">{previewError}</span></div>
                    {isCurrent && <button className="btn sm" onClick={fixError} disabled={busy}>{t.studio.fixIt}</button>}
                  </div>
                )}
                <iframe
                  key={`${view.previewUrl}-${frameKey}`}
                  ref={frameRef}
                  className="studio-frame"
                  src={view.previewUrl}
                  title={t.studio.previewTab}
                  sandbox="allow-scripts allow-forms allow-modals allow-popups allow-downloads"
                  referrerPolicy="no-referrer"
                />
              </div>
            ) : (
              <div className="empty"><I.IconWand /><div>{t.studio.noPreview}</div></div>
            )
          ) : paths.length === 0 ? (
            <div className="empty"><I.IconCode /><div>{t.studio.noFiles}</div></div>
          ) : (
            <div className="studio-code">
              <div className="studio-tree" aria-label={t.studio.files}>
                {paths.map((p) => (
                  <button key={p} className="mono ltr truncate" aria-pressed={p === shownFile} onClick={() => setSelectedFile(p)}>{p}</button>
                ))}
              </div>
              <div className="studio-source">
                {shownFile && (
                  <>
                    <div className="row between small muted">
                      <span className="mono ltr">{shownFile}</span>
                      <button className="btn sm ghost" onClick={() => void copy(view.files[shownFile] ?? "")}><I.IconCopy /> {t.common.copy}</button>
                    </div>
                    <pre className="ltr" dir="ltr"><code>{view.files[shownFile]}</code></pre>
                  </>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
      {toast && <div className={`toast ${toast.bad ? "bad" : ""}`} role="status">{toast.text}</div>}
    </div>
  );
}
