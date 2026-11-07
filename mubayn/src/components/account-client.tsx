"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { translator, type Locale } from "@/lib/i18n";
import { api } from "./api";
import { RecoveryCodeNotice } from "./auth-forms";
import { errorText } from "./errors";
import { useHydrated } from "./use-hydrated";

export function ChangePassword({ locale }: { locale: Locale }) {
  const t = translator(locale);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const hydrated = useHydrated();
  return (
    <form method="post" className="form" onSubmit={async (e) => {
      e.preventDefault();
      const form = e.currentTarget;
      const f = new FormData(form);
      const r = await api("POST", "/api/account/password", { current: f.get("current"), next: f.get("next") });
      setMsg(r.ok ? { ok: true, text: t("acc_saved") } : { ok: false, text: errorText(r.error, locale) });
      if (r.ok) form.reset();
    }}>
      <div className="field"><label htmlFor="current">{t("acc_current_pw")}</label><input id="current" name="current" type="password" required autoComplete="current-password" dir="ltr" /></div>
      <div className="field"><label htmlFor="next">{t("acc_new_pw")}</label><input id="next" name="next" type="password" required minLength={10} autoComplete="new-password" dir="ltr" /><span className="hint">{t("password_hint")}</span></div>
      {msg && <div className={`alert ${msg.ok ? "alert-ok" : "alert-error"}`}>{msg.text}</div>}
      <div><button className="btn" disabled={!hydrated}>{t("acc_change_pw")}</button></div>
    </form>
  );
}

export function RegenerateRecoveryCode({ locale }: { locale: Locale }) {
  const t = translator(locale);
  const router = useRouter();
  const hydrated = useHydrated();
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (code) return <RecoveryCodeNotice code={code} locale={locale} />;
  return (
    <form method="post" className="form" onSubmit={async (e) => {
      e.preventDefault();
      setError(null);
      const f = new FormData(e.currentTarget);
      const r = await api<{ recoveryCode: string }>("POST", "/api/account/recovery-code", { password: f.get("password") });
      if (!r.ok) return setError(errorText(r.error, locale));
      setCode(r.data.recoveryCode);
      router.refresh();
    }}>
      <div className="field"><label htmlFor="rc-password">{t("acc_current_pw")}</label><input id="rc-password" name="password" type="password" required autoComplete="current-password" dir="ltr" /></div>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <div><button className="btn" disabled={!hydrated}>{t("acc_rc_btn")}</button></div>
    </form>
  );
}

export function DeleteAccount({ locale }: { locale: Locale }) {
  const t = translator(locale);
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const hydrated = useHydrated();
  return (
    <form method="post" className="form" onSubmit={async (e) => {
      e.preventDefault();
      if (!confirm(t("acc_delete") + "?")) return;
      const f = new FormData(e.currentTarget);
      setBusy(true);
      const r = await api("POST", "/api/account/delete", { password: f.get("password") });
      setBusy(false);
      if (!r.ok) return setError(errorText(r.error, locale));
      router.push("/");
      router.refresh();
    }}>
      <p className="muted">{t("acc_delete_warn")}</p>
      <div className="field"><label htmlFor="del-password">{t("password")}</label><input id="del-password" name="password" type="password" required autoComplete="current-password" dir="ltr" /></div>
      {error && <div className="alert alert-error">{error}</div>}
      <div><button className="btn btn-danger" disabled={busy || !hydrated}>{t("acc_delete_btn")}</button></div>
    </form>
  );
}
