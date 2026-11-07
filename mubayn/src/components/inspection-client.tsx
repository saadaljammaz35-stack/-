"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { translator, type Key, type Locale } from "@/lib/i18n";
import { api } from "./api";
import { errorText } from "./errors";

type Device = {
  deviceCategory: string; brand: string; model: string; storage: string | null; color: string | null;
  purchaseContext: string; sellerClaims: string | null; askingPrice: string | null; reportLanguage: "ar" | "en";
};

const CATS = ["phone", "tablet", "laptop", "smartwatch", "console", "camera", "headphones", "other"] as const;

export function DeviceForm({ locale, inspectionId, initial }: { locale: Locale; inspectionId?: string; initial?: Device }) {
  const t = translator(locale);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const v = initial;
  return (
    <form
      method="post"
      className="form"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const s = (k: string) => { const x = String(f.get(k) ?? "").trim(); return x || null; };
        const body = {
          deviceCategory: f.get("deviceCategory"), brand: s("brand"), model: s("model"), storage: s("storage"), color: s("color"),
          purchaseContext: f.get("purchaseContext"), sellerClaims: s("sellerClaims"), askingPrice: s("askingPrice"), reportLanguage: f.get("reportLanguage"),
        };
        setBusy(true); setError(null); setSaved(false);
        const r = inspectionId
          ? await api("PATCH", `/api/inspections/${inspectionId}`, body)
          : await api<{ id: string }>("POST", "/api/inspections", body);
        setBusy(false);
        if (!r.ok) return setError(errorText(r.error, locale));
        if (!inspectionId) router.push(`/inspections/${(r.data as { id: string }).id}#evidence`);
        else { setSaved(true); router.refresh(); }
      }}
    >
      <div className="grid-2">
        <div className="field">
          <label htmlFor="deviceCategory">{t("f_category")}</label>
          <select id="deviceCategory" name="deviceCategory" defaultValue={v?.deviceCategory ?? "phone"}>
            {CATS.map((c) => <option key={c} value={c}>{t(`cat_${c}` as Key)}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="purchaseContext">{t("f_context")}</label>
          <select id="purchaseContext" name="purchaseContext" defaultValue={v?.purchaseContext ?? "buying"}>
            <option value="buying">{t("ctx_buying")}</option>
            <option value="selling">{t("ctx_selling")}</option>
            <option value="owner">{t("ctx_owner")}</option>
          </select>
        </div>
        <div className="field"><label htmlFor="brand">{t("f_brand")}</label><input id="brand" name="brand" required maxLength={60} defaultValue={v?.brand} placeholder="Apple, Samsung, Lenovo…" /></div>
        <div className="field"><label htmlFor="model">{t("f_model")}</label><input id="model" name="model" required maxLength={120} defaultValue={v?.model} placeholder="iPhone 14 Pro, Galaxy S23…" /></div>
        <div className="field"><label htmlFor="storage">{t("f_storage")}</label><input id="storage" name="storage" maxLength={40} defaultValue={v?.storage ?? ""} /></div>
        <div className="field"><label htmlFor="color">{t("f_color")}</label><input id="color" name="color" maxLength={40} defaultValue={v?.color ?? ""} /></div>
      </div>
      <div className="field"><label htmlFor="sellerClaims">{t("f_claims")}</label><textarea id="sellerClaims" name="sellerClaims" maxLength={2000} defaultValue={v?.sellerClaims ?? ""} placeholder={t("f_claims_ph")} /></div>
      <div className="grid-2">
        <div className="field"><label htmlFor="askingPrice">{t("f_price")}</label><input id="askingPrice" name="askingPrice" maxLength={60} defaultValue={v?.askingPrice ?? ""} /></div>
        <div className="field">
          <label htmlFor="reportLanguage">{t("f_lang")}</label>
          <select id="reportLanguage" name="reportLanguage" defaultValue={v?.reportLanguage ?? locale}>
            <option value="ar">العربية</option><option value="en">English</option>
          </select>
        </div>
      </div>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      {saved && <div className="alert alert-ok" role="status">{t("acc_saved")}</div>}
      <div><button className="btn btn-signal" disabled={busy}>{busy ? t("loading") : inspectionId ? t("save") : t("save_continue")}</button></div>
    </form>
  );
}

type Ev = { id: string; kind: string; status: string; label: string | null; filename: string | null; durationMs: number | null };
type Uploading = { key: string; name: string; progress: number; phase: "upload" | "check" | "error"; error?: string };

function putWithProgress(url: string, headers: Record<string, string>, file: File, onProgress: (p: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error("Upload failed (network)"));
    xhr.send(file);
  });
}

export function EvidenceUploader({ locale, inspectionId, initial, editable }: { locale: Locale; inspectionId: string; initial: Ev[]; editable: boolean }) {
  const t = translator(locale);
  const router = useRouter();
  const [items, setItems] = useState<Ev[]>(initial);
  const [uploads, setUploads] = useState<Uploading[]>([]);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const upload = useCallback(async (file: File) => {
    const key = `${file.name}-${file.size}-${Math.random()}`;
    const set = (u: Partial<Uploading>) => setUploads((xs) => xs.map((x) => (x.key === key ? { ...x, ...u } : x)));
    setUploads((xs) => [...xs, { key, name: file.name, progress: 0, phase: "upload" }]);
    const req = await api<{ evidenceId: string; uploadUrl: string; headers: Record<string, string> }>("POST", `/api/inspections/${inspectionId}/evidence`, {
      filename: file.name, contentType: file.type || "application/octet-stream", bytes: file.size,
    });
    if (!req.ok) return set({ phase: "error", error: errorText(req.error, locale) });
    try {
      await putWithProgress(req.data.uploadUrl, req.data.headers, file, (p) => set({ progress: p }));
    } catch (e) {
      await api("DELETE", `/api/evidence/${req.data.evidenceId}`);
      return set({ phase: "error", error: (e as Error).message });
    }
    set({ phase: "check", progress: 1 });
    const done = await api<{ id: string; status: string; kind: string; durationMs: number | null }>("POST", `/api/evidence/${req.data.evidenceId}/complete`);
    if (!done.ok) return set({ phase: "error", error: errorText(done.error, locale) });
    setUploads((xs) => xs.filter((x) => x.key !== key));
    setItems((xs) => [...xs, { id: done.data.id, kind: done.data.kind, status: done.data.status, label: null, filename: file.name, durationMs: done.data.durationMs }]);
    router.refresh();
  }, [inspectionId, locale, router]);

  const onFiles = (files: FileList | null) => {
    if (!files) return;
    // Sequential: keeps memory and server checks predictable on phones.
    (async () => { for (const f of Array.from(files)) await upload(f); })();
  };

  const images = items.filter((i) => i.kind === "image" && i.status === "ready").length;
  return (
    <div className="stack">
      {editable && (
        <div
          className={`drop${over ? " over" : ""}`}
          onClick={() => input.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); onFiles(e.dataTransfer.files); }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") input.current?.click(); }}
        >
          <strong>{t("ev_pick")}</strong>
          <div className="small muted">{t("ev_types")}</div>
          <input ref={input} type="file" multiple hidden accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm" onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />
        </div>
      )}
      <div className="spread small">
        <span><strong>{images}</strong> {t("ev_count")}</span>
        {images < 4 && editable && <span className="chip">{t("ev_min")}</span>}
      </div>
      <div className="ev-grid">
        {items.map((e) => (
          <div className="ev-tile" key={e.id}>
            <div className="thumb">
              {e.kind === "image"
                ? <img src={`/api/evidence/${e.id}/file`} alt={e.filename ?? ""} loading="lazy" />
                : <video src={`/api/evidence/${e.id}/file`} muted playsInline controls preload="metadata" />}
            </div>
            <div className="meta">
              <span className="spread"><span className="chip">{e.kind === "image" ? t("photo") : "Video"}</span>
                {editable && <button className="link small" onClick={async () => {
                  const r = await api("DELETE", `/api/evidence/${e.id}`);
                  if (r.ok) { setItems((xs) => xs.filter((x) => x.id !== e.id)); router.refresh(); }
                }}>{t("ev_remove")}</button>}
              </span>
              <span className="muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} dir="ltr">{e.filename}</span>
            </div>
          </div>
        ))}
        {uploads.map((u) => (
          <div className="ev-tile" key={u.key}>
            <div className="thumb small muted" style={{ padding: 10, textAlign: "center" }}>
              {u.phase === "error" ? <span style={{ color: "var(--bad)" }}>{u.error}</span> : u.phase === "check" ? t("ev_checking") : `${t("ev_uploading")} ${Math.round(u.progress * 100)}%`}
            </div>
            <div className="meta">
              {u.phase !== "error" && <div className="bar" aria-label="progress"><i style={{ width: `${Math.round(u.progress * 100)}%` }} /></div>}
              <span className="muted" dir="ltr" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name}</span>
              {u.phase === "error" && <button className="link small" onClick={() => setUploads((xs) => xs.filter((x) => x.key !== u.key))}>✕</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SubmitPanel({ locale, inspectionId, canSubmit, remaining, verified }: { locale: Locale; inspectionId: string; canSubmit: boolean; remaining: number | null; verified: boolean }) {
  const t = translator(locale);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="card stack">
      <h2 style={{ fontSize: "1.3rem" }}>{t("submit_title")}</h2>
      <p className="muted">{t("submit_note")}</p>
      {remaining !== null && <p className="small">{t("quota_left")}: <strong>{remaining}</strong></p>}
      {!verified && <div className="alert alert-warn">{t("verify_banner")}</div>}
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <div className="row">
        <button className="btn btn-signal" disabled={busy || !canSubmit || !verified || (remaining !== null && remaining <= 0)} onClick={async () => {
          setBusy(true); setError(null);
          const r = await api("POST", `/api/inspections/${inspectionId}/submit`);
          setBusy(false);
          if (!r.ok) return setError(errorText(r.error, locale));
          router.refresh();
        }}>{busy ? t("loading") : t("submit_btn")}</button>
        <button className="btn btn-ghost btn-sm" disabled={busy} onClick={async () => {
          if (!confirm(t("delete_draft") + "?")) return;
          const r = await api("DELETE", `/api/inspections/${inspectionId}`);
          if (r.ok) router.push("/dashboard");
        }}>{t("delete_draft")}</button>
      </div>
    </div>
  );
}

export function StatusPoller({ inspectionId, status }: { inspectionId: string; status: string }) {
  const router = useRouter();
  useEffect(() => {
    if (status !== "queued" && status !== "analyzing") return;
    const id = setInterval(async () => {
      const r = await api<{ status: string; reportId: string | null }>("GET", `/api/inspections/${inspectionId}`);
      if (r.ok && r.data.status !== status) {
        if (r.data.reportId) router.push(`/reports/${r.data.reportId}`);
        else router.refresh();
      }
    }, 4000);
    return () => clearInterval(id);
  }, [inspectionId, status, router]);
  return null;
}

export function RetryButton({ locale, inspectionId }: { locale: Locale; inspectionId: string }) {
  const t = translator(locale);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="stack">
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <button className="btn" disabled={busy} onClick={async () => {
        setBusy(true); setError(null);
        const r = await api("POST", `/api/inspections/${inspectionId}/retry`);
        setBusy(false);
        if (!r.ok) return setError(errorText(r.error, locale));
        router.refresh();
      }}>{t("retry_btn")}</button>
    </div>
  );
}

export function ResendVerification({ locale }: { locale: Locale }) {
  const t = translator(locale);
  const [sent, setSent] = useState(false);
  return sent ? <span className="small">{t("verify_sent")}</span> : (
    <button className="link small" onClick={async () => { const r = await api("POST", "/api/auth/resend-verification"); if (r.ok) setSent(true); }}>{t("verify_resend")}</button>
  );
}
