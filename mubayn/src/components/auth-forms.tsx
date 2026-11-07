"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { translator, type Locale } from "@/lib/i18n";
import { api } from "./api";
import { errorText } from "./errors";
import { useHydrated } from "./use-hydrated";

function useForm(locale: Locale) {
  const hydrated = useHydrated();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async <T,>(fn: () => Promise<{ ok: true; data: T } | { ok: false; error: { code: string; message: string } }>, onOk: (d: T) => void) => {
    setBusy(true);
    setError(null);
    const r = await fn();
    setBusy(false);
    if (r.ok) onOk(r.data);
    else setError(errorText(r.error, locale));
  };
  return { busy: busy || !hydrated, error, run };
}

export function RegisterForm({ locale }: { locale: Locale }) {
  const t = translator(locale);
  const { busy, error, run } = useForm(locale);
  const [done, setDone] = useState(false);
  if (done) return <div className="alert alert-ok" role="status">{t("register_done")}</div>;
  return (
    <form
      method="post"
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        run(
          () => api("POST", "/api/auth/register", {
            fullName: f.get("fullName"), email: f.get("email"), password: f.get("password"), locale, acceptTerms: f.get("terms") === "on",
          }),
          () => setDone(true),
        );
      }}
    >
      <div className="field"><label htmlFor="fullName">{t("full_name")}</label><input id="fullName" name="fullName" required maxLength={100} autoComplete="name" /></div>
      <div className="field"><label htmlFor="email">{t("email")}</label><input id="email" name="email" type="email" required autoComplete="email" dir="ltr" /></div>
      <div className="field">
        <label htmlFor="password">{t("password")}</label>
        <input id="password" name="password" type="password" required minLength={10} maxLength={128} autoComplete="new-password" dir="ltr" />
        <span className="hint">{t("password_hint")}</span>
      </div>
      <label className="check small"><input type="checkbox" name="terms" required /> <span><Link href="/terms">{t("agree_terms")}</Link></span></label>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <button className="btn btn-signal" disabled={busy}>{busy ? t("loading") : t("register_btn")}</button>
      <p className="small muted">{t("have_account")} <Link href="/login">{t("nav_login")}</Link></p>
    </form>
  );
}

export function LoginForm({ locale }: { locale: Locale }) {
  const t = translator(locale);
  const router = useRouter();
  const next = useSearchParams().get("next");
  const { busy, error, run } = useForm(locale);
  return (
    <form
      method="post"
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        run(
          () => api<{ role: string }>("POST", "/api/auth/login", { email: f.get("email"), password: f.get("password") }),
          (d) => {
            // Same-site paths only: "//host" and "/\\host" are treated as other sites by browsers.
            const safeNext = next && /^\/(?![\/\\])/.test(next) ? next : null;
            router.push(safeNext ?? (d.role === "admin" ? "/admin" : "/dashboard"));
            router.refresh();
          },
        );
      }}
    >
      <div className="field"><label htmlFor="email">{t("email")}</label><input id="email" name="email" type="email" required autoComplete="email" dir="ltr" /></div>
      <div className="field"><label htmlFor="password">{t("password")}</label><input id="password" name="password" type="password" required autoComplete="current-password" dir="ltr" /></div>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <button className="btn" disabled={busy}>{busy ? t("loading") : t("login_btn")}</button>
      <div className="spread small"><Link href="/forgot-password">{t("forgot")}</Link><span>{t("no_account")} <Link href="/register">{t("register_btn")}</Link></span></div>
    </form>
  );
}

export function ForgotForm({ locale }: { locale: Locale }) {
  const t = translator(locale);
  const { busy, error, run } = useForm(locale);
  const [done, setDone] = useState(false);
  if (done) return <div className="alert alert-ok" role="status">{t("forgot_done")}</div>;
  return (
    <form method="post" className="form" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); run(() => api("POST", "/api/auth/forgot", { email: f.get("email") }), () => setDone(true)); }}>
      <div className="field"><label htmlFor="email">{t("email")}</label><input id="email" name="email" type="email" required autoComplete="email" dir="ltr" /></div>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <button className="btn" disabled={busy}>{t("forgot_btn")}</button>
    </form>
  );
}

export function ResetForm({ locale }: { locale: Locale }) {
  const t = translator(locale);
  const token = useSearchParams().get("token") ?? "";
  const { busy, error, run } = useForm(locale);
  const [done, setDone] = useState(false);
  if (done) return <div className="alert alert-ok" role="status">{t("reset_done")} <Link href="/login">{t("nav_login")}</Link></div>;
  return (
    <form method="post" className="form" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); run(() => api("POST", "/api/auth/reset", { token, password: f.get("password") }), () => setDone(true)); }}>
      <div className="field">
        <label htmlFor="password">{t("acc_new_pw")}</label>
        <input id="password" name="password" type="password" required minLength={10} maxLength={128} autoComplete="new-password" dir="ltr" />
        <span className="hint">{t("password_hint")}</span>
      </div>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <button className="btn" disabled={busy || !token}>{t("reset_btn")}</button>
    </form>
  );
}

export function VerifyEmail({ locale }: { locale: Locale }) {
  const t = translator(locale);
  const token = useSearchParams().get("token") ?? "";
  const [state, setState] = useState<"working" | "ok" | "bad">("working");
  const sent = useRef(false);
  useEffect(() => {
    if (!token) { setState("bad"); return; }
    if (sent.current) return;
    sent.current = true;
    api("POST", "/api/auth/verify-email", { token }).then((r) => setState(r.ok ? "ok" : "bad"));
  }, [token]);
  if (state === "working") return <p>{t("loading")}</p>;
  return state === "ok"
    ? <div className="alert alert-ok" role="status">{t("verify_ok")} <Link href="/dashboard">{t("nav_dashboard")}</Link></div>
    : <div className="alert alert-error" role="alert">{t("verify_bad")}</div>;
}
