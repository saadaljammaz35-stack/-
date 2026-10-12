import type { ReactNode } from "react";
import { Link } from "react-router";
import { useAuth } from "@/auth/useAuth";
import { LanguageToggle } from "@/components/brand/LanguageToggle";
import { Logo } from "@/components/brand/Logo";
import { ButtonLink } from "@/components/ui";
import { useI18n } from "@/i18n";

/** Header + footer for public pages (marketing, legal, 404). */
export function PublicLayout({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const { session } = useAuth();
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="border-b border-slate-200/70 bg-white/90 pt-safe backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center gap-2 px-4 sm:px-6">
          <Link to="/" className="-m-1 rounded-xl p-1" aria-label={t("common.goHome")}>
            <Logo size={34} />
          </Link>
          <div className="ms-auto flex items-center gap-1 sm:gap-2">
            <LanguageToggle />
            {session ? (
              <ButtonLink to="/app" size="sm">
                {t("marketing.ctaDashboard")}
              </ButtonLink>
            ) : (
              <ButtonLink to="/login" size="sm" variant="outline">
                {t("marketing.ctaSignIn")}
              </ButtonLink>
            )}
          </div>
        </div>
      </header>
      <main id="main" className="flex-1">
        {children}
      </main>
      <footer className="border-t border-slate-200 bg-white pb-safe">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-slate-600 sm:flex-row sm:px-6">
          <p>{t("marketing.footerRights", { year: new Date().getFullYear() })}</p>
          <nav className="flex gap-1">
            <Link to="/privacy" className="inline-flex min-h-11 items-center rounded-lg px-3 hover:text-primary">
              {t("legal.privacyTitle")}
            </Link>
            <Link to="/terms" className="inline-flex min-h-11 items-center rounded-lg px-3 hover:text-primary">
              {t("legal.termsTitle")}
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
