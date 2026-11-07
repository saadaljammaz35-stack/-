import Link from "next/link";
import { currentSession } from "@/lib/auth";
import { t, type Locale } from "@/lib/i18n";
import { LangSwitch, LogoutButton } from "./client-actions";
import { LogoMark } from "./logo";

export async function Header({ locale }: { locale: Locale }) {
  const s = await currentSession();
  return (
    <header className="site-header">
      <div className="wrap">
        <Link href="/" className="logo" aria-label="MUBAYN">
          <LogoMark />
          <span>{t(locale, "brand")}</span>
        </Link>
        <nav className="nav" aria-label="main">
          <Link className="hide-sm" href="/#how">{t(locale, "nav_how")}</Link>
          <Link className="hide-sm" href="/faq">{t(locale, "nav_faq")}</Link>
          {s ? (
            <>
              <Link href="/dashboard">{t(locale, "nav_dashboard")}</Link>
              <Link className="hide-sm" href="/account">{t(locale, "nav_account")}</Link>
              {s.user.role === "admin" && <Link href="/admin">{t(locale, "nav_admin")}</Link>}
              <LogoutButton label={t(locale, "nav_logout")} />
            </>
          ) : (
            <>
              <Link href="/login">{t(locale, "nav_login")}</Link>
              <Link href="/register" className="btn btn-sm btn-signal">{t(locale, "nav_register")}</Link>
            </>
          )}
          <LangSwitch to={locale === "ar" ? "en" : "ar"} label={t(locale, "switch_lang")} />
        </nav>
      </div>
    </header>
  );
}

export function Footer({ locale }: { locale: Locale }) {
  const name = process.env.BUSINESS_LEGAL_NAME;
  return (
    <footer className="site-footer">
      <div className="wrap spread">
        <div>
          <div className="row" style={{ gap: 8 }}>
            <LogoMark /> <strong style={{ color: "var(--ink)" }}>{t(locale, "brand")} · MUBAYN</strong>
          </div>
          <div className="small" style={{ marginTop: 6 }}>
            © {new Date().getFullYear()} {name ?? "MUBAYN"}. {t(locale, "footer_rights")}.
          </div>
        </div>
        <nav aria-label="legal">
          <Link href="/terms">{t(locale, "footer_terms")}</Link>
          <Link href="/privacy">{t(locale, "footer_privacy")}</Link>
          <Link href="/ai-limits">{t(locale, "footer_ai")}</Link>
          <Link href="/faq">{t(locale, "nav_faq")}</Link>
          <Link href="/contact">{t(locale, "nav_contact")}</Link>
        </nav>
      </div>
    </footer>
  );
}
