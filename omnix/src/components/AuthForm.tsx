"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/client/api";
import type { Dict, Locale } from "@/lib/i18n";

export function AuthForm({ mode, t, locale }: { mode: "login" | "register"; t: Dict; locale: Locale }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      if (mode === "register") {
        await api("/api/auth/register", { body: { email: f.get("email"), password: f.get("password"), displayName: f.get("name"), locale } });
      } else {
        await api("/api/auth/login", { body: { email: f.get("email"), password: f.get("password") } });
      }
      router.replace("/ai");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.common.error);
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <form className="card glass stack" onSubmit={submit}>
        <Image className="logo-mark" src="/brand/omnix-logo.png" alt="OMNIX" width={150} height={35} priority style={{ height: "auto" }} />
        <div>
          <h1>{mode === "login" ? t.auth.signIn : t.auth.register}</h1>
          <p className="muted small" style={{ margin: 0 }}>{t.tagline}</p>
        </div>
        {mode === "register" && (
          <label className="field">
            <span>{t.auth.name}</span>
            <input className="input" name="name" required maxLength={120} autoComplete="name" />
          </label>
        )}
        <label className="field">
          <span>{t.auth.email}</span>
          <input className="input ltr" name="email" type="email" required autoComplete="email" />
        </label>
        <label className="field">
          <span>{t.auth.password}</span>
          <input className="input ltr" name="password" type="password" required minLength={mode === "register" ? 10 : 1} autoComplete={mode === "login" ? "current-password" : "new-password"} />
          {mode === "register" && <span className="hint">{t.auth.passwordHint}</span>}
        </label>
        {error && <div className="alert bad" role="alert">{error}</div>}
        <button className="btn primary" disabled={busy}>
          {busy ? t.common.loading : mode === "login" ? t.auth.signIn : t.auth.register}
        </button>
        <p className="small muted" style={{ margin: 0, textAlign: "center" }}>
          {mode === "login" ? t.auth.noAccount : t.auth.haveAccount}{" "}
          <Link href={mode === "login" ? "/register" : "/login"} style={{ color: "var(--accent)" }}>
            {mode === "login" ? t.auth.register : t.auth.signIn}
          </Link>
        </p>
      </form>
    </div>
  );
}
