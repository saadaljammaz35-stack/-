"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "./api";

export function AdminAction({ url, body, label, confirmText, danger, withNote }: {
  url: string; body: Record<string, unknown>; label: string; confirmText?: string; danger?: boolean; withNote?: "optional" | "required";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <span className="row" style={{ display: "inline-flex", gap: 6 }}>
      <button className={`btn btn-sm ${danger ? "btn-danger" : ""}`} disabled={busy} onClick={async () => {
        let note: string | null = null;
        if (withNote) {
          note = prompt(withNote === "required" ? "Note (required)" : "Note (optional)");
          if (note === null || (withNote === "required" && note.trim().length < 3)) return;
        } else if (confirmText && !confirm(confirmText)) return;
        setBusy(true); setMsg(null);
        const r = await api("POST", url, note !== null ? { ...body, note } : body);
        setBusy(false);
        if (!r.ok) setMsg(r.error.message); else router.refresh();
      }}>{label}</button>
      {msg && <span className="small" style={{ color: "var(--bad)" }}>{msg}</span>}
    </span>
  );
}

type Limits = { maxImages: number; maxVideos: number; maxVideoSeconds: number; monthlyInspectionsPerUser: number; dailyAnalysesGlobal: number; signupsOpen: boolean; submissionsOpen: boolean };

export function LimitsForm({ initial }: { initial: Limits }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const num = (k: keyof Limits, label: string, hint: string) => (
    <div className="field"><label htmlFor={k}>{label}</label><input id={k} name={k} type="number" defaultValue={initial[k] as number} required /><span className="hint">{hint}</span></div>
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
      setMsg(r.ok ? { ok: true, text: "Saved" } : { ok: false, text: `${r.error.message} ${JSON.stringify(r.error.details ?? "")}` });
      if (r.ok) router.refresh();
    }}>
      <div className="grid-2">
        {num("monthlyInspectionsPerUser", "Free inspections per user per month", "0 stops new submissions for everyone")}
        {num("dailyAnalysesGlobal", "Max submissions per day (all users)", "Caps your daily AI spend")}
        {num("maxImages", "Max photos per inspection", "4 to 40")}
        {num("maxVideos", "Max videos per inspection", "0 to 3 (0 disables video)")}
        {num("maxVideoSeconds", "Max video length (seconds)", "5 to 180")}
      </div>
      <label className="check"><input type="checkbox" name="signupsOpen" defaultChecked={initial.signupsOpen} /> Sign-ups open</label>
      <label className="check"><input type="checkbox" name="submissionsOpen" defaultChecked={initial.submissionsOpen} /> Submissions open</label>
      {msg && <div className={`alert ${msg.ok ? "alert-ok" : "alert-error"}`}>{msg.text}</div>}
      <div><button className="btn">Save limits</button></div>
    </form>
  );
}

export function MfaEnrol({ enrolled }: { enrolled: boolean }) {
  const router = useRouter();
  const [setup, setSetup] = useState<{ secret: string; svg: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="stack">
      {!enrolled && !setup && (
        <button className="btn" onClick={async () => {
          const r = await api<{ secret: string; svg: string }>("POST", "/api/auth/mfa/setup");
          if (r.ok) setSetup(r.data); else setError(r.error.message);
        }}>Set up authenticator app</button>
      )}
      {setup && (
        <div className="stack">
          <p>Scan with an authenticator app (Google Authenticator, 1Password, Authy), or enter the key manually.</p>
          <div style={{ background: "#fff", padding: 10, width: 240, borderRadius: 8 }} dangerouslySetInnerHTML={{ __html: setup.svg }} />
          <p className="mono">{setup.secret}</p>
        </div>
      )}
      {(enrolled || setup) && (
        <form method="post" className="form" onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const r = await api("POST", "/api/auth/mfa/verify", { code: String(f.get("code") ?? "").trim() });
          if (r.ok) { router.push("/admin"); router.refresh(); } else setError(r.error.message);
        }}>
          <div className="field"><label htmlFor="code">6-digit code</label><input id="code" name="code" inputMode="numeric" maxLength={6} minLength={6} required autoComplete="one-time-code" dir="ltr" /></div>
          <div><button className="btn btn-signal">Verify</button></div>
        </form>
      )}
      {error && <div className="alert alert-error">{error}</div>}
    </div>
  );
}
