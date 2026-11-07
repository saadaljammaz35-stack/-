"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { adminT } from "@/lib/admin-i18n";
import type { Locale } from "@/lib/i18n";
import { api } from "./api";
import { errorText } from "./errors";

export function AdminAction({ url, body, label, confirmText, danger, withNote, locale = "ar" }: {
  url: string; body: Record<string, unknown>; label: string; confirmText?: string; danger?: boolean; withNote?: "optional" | "required"; locale?: Locale;
}) {
  const t = adminT(locale);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <span className="row" style={{ display: "inline-flex", gap: 6 }}>
      <button className={`btn btn-sm ${danger ? "btn-danger" : ""}`} disabled={busy} onClick={async () => {
        let note: string | null = null;
        if (withNote) {
          note = prompt(withNote === "required" ? t("note_required") : t("note_optional"));
          if (note === null || (withNote === "required" && note.trim().length < 3)) return;
        } else if (confirmText && !confirm(confirmText)) return;
        setBusy(true); setMsg(null);
        const r = await api("POST", url, note !== null ? { ...body, note } : body);
        setBusy(false);
        if (!r.ok) setMsg(errorText(r.error, locale)); else router.refresh();
      }}>{label}</button>
      {msg && <span className="small" style={{ color: "var(--bad)" }}>{msg}</span>}
    </span>
  );
}

/** Issues a recovery code for a customer (no-email deployments) and shows it once. */
export function AdminRecoveryCode({ userId, locale = "ar" }: { userId: string; locale?: Locale }) {
  const t = adminT(locale);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  if (code) {
    return (
      <div className="card-flat stack" role="status" style={{ width: "100%" }}>
        <span className="small">{t("rc_issued")}</span>
        <div className="row">
          <span className="mono" dir="ltr" style={{ fontSize: "1.15rem", userSelect: "all" }}>{code}</span>
          <button type="button" className="btn btn-sm btn-ghost" onClick={async () => { try { await navigator.clipboard.writeText(code); setCopied(true); } catch { /* selectable */ } }}>{copied ? t("copied") : t("copy")}</button>
        </div>
      </div>
    );
  }
  return (
    <span className="row" style={{ display: "inline-flex", gap: 6 }}>
      <button className="btn btn-sm" disabled={busy} onClick={async () => {
        if (!confirm(t("rc_issue_confirm"))) return;
        setBusy(true); setMsg(null);
        const r = await api<{ recoveryCode: string }>("POST", `/api/admin/users/${userId}`, { action: "recovery_code" });
        setBusy(false);
        if (!r.ok) setMsg(errorText(r.error, locale)); else setCode(r.data.recoveryCode);
      }}>{t("rc_issue")}</button>
      {msg && <span className="small" style={{ color: "var(--bad)" }}>{msg}</span>}
    </span>
  );
}

type Limits = { maxImages: number; maxVideos: number; maxVideoSeconds: number; monthlyInspectionsPerUser: number; dailyAnalysesGlobal: number; signupsOpen: boolean; submissionsOpen: boolean };

export function LimitsForm({ initial, locale = "ar" }: { initial: Limits; locale?: Locale }) {
  const t = adminT(locale);
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const num = (k: keyof Limits, label: string, hint: string) => (
    <div className="field"><label htmlFor={k}>{label}</label><input id={k} name={k} type="number" defaultValue={initial[k] as number} required dir="ltr" /><span className="hint">{hint}</span></div>
  );
  return (
    <form method="post" className="form" onSubmit={async (e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      const n = (k: string) => Number(f.get(k));
      const r = await api("PUT", "/api/admin/settings", {
        maxImages: n("maxImages"), maxVideos: n("maxVideos"), maxVideoSeconds: n("maxVideoSeconds"),
        monthlyInspectionsPerUser: n("monthlyInspectionsPerUser"), dailyAnalysesGlobal: n("dailyAnalysesGlobal"),
        signupsOpen: f.get("signupsOpen") === "on", submissionsOpen: f.get("submissionsOpen") === "on",
      });
      setMsg(r.ok ? { ok: true, text: t("saved") } : { ok: false, text: errorText(r.error, locale) });
      if (r.ok) router.refresh();
    }}>
      <div className="grid-2">
        {num("monthlyInspectionsPerUser", t("l_monthly"), t("l_monthly_hint"))}
        {num("dailyAnalysesGlobal", t("l_daily"), t("l_daily_hint"))}
        {num("maxImages", t("l_images"), t("l_images_hint"))}
        {num("maxVideos", t("l_videos"), t("l_videos_hint"))}
        {num("maxVideoSeconds", t("l_seconds"), t("l_seconds_hint"))}
      </div>
      <label className="check"><input type="checkbox" name="signupsOpen" defaultChecked={initial.signupsOpen} /> {t("l_signups")}</label>
      <label className="check"><input type="checkbox" name="submissionsOpen" defaultChecked={initial.submissionsOpen} /> {t("l_submissions")}</label>
      {msg && <div className={`alert ${msg.ok ? "alert-ok" : "alert-error"}`}>{msg.text}</div>}
      <div><button className="btn">{t("save_limits")}</button></div>
    </form>
  );
}

export function MfaEnrol({ enrolled, locale = "ar" }: { enrolled: boolean; locale?: Locale }) {
  const t = adminT(locale);
  const router = useRouter();
  const [setup, setSetup] = useState<{ secret: string; svg: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="stack">
      {!enrolled && !setup && (
        <button className="btn" onClick={async () => {
          const r = await api<{ secret: string; svg: string }>("POST", "/api/auth/mfa/setup");
          if (r.ok) setSetup(r.data); else setError(errorText(r.error, locale));
        }}>{t("mfa_setup")}</button>
      )}
      {setup && (
        <div className="stack">
          <p>{t("mfa_scan")}</p>
          <div style={{ background: "#fff", padding: 10, width: 240, borderRadius: 8 }} dangerouslySetInnerHTML={{ __html: setup.svg }} />
          <p className="mono" style={{ wordBreak: "break-all", fontSize: "1rem", userSelect: "all" }}>{setup.secret}</p>
        </div>
      )}
      {(enrolled || setup) && (
        <form method="post" className="form" onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const r = await api("POST", "/api/auth/mfa/verify", { code: String(f.get("code") ?? "").trim() });
          if (r.ok) { router.push("/admin"); router.refresh(); } else setError(errorText(r.error, locale));
        }}>
          <div className="field"><label htmlFor="code">{t("mfa_code")}</label><input id="code" name="code" inputMode="numeric" maxLength={6} minLength={6} required autoComplete="one-time-code" dir="ltr" /></div>
          <div><button className="btn btn-signal">{t("mfa_verify")}</button></div>
        </form>
      )}
      {error && <div className="alert alert-error">{error}</div>}
    </div>
  );
}
