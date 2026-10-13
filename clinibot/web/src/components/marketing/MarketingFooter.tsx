import { Link } from "react-router";
import { Logo } from "@/components/brand/Logo";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/cn";
import { container } from "./styles";

const footerLink =
  "mk-link inline-flex min-h-11 items-center rounded-lg px-2 text-[0.9375rem] text-slate-700";

export function MarketingFooter({ onHome }: { onHome: boolean }) {
  const { t } = useI18n();
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-slate-200/80 bg-canvas/70 pb-safe">
      <div
        className={cn(
          container,
          "flex flex-col gap-8 py-10 md:flex-row md:items-start md:justify-between",
        )}
      >
        <div className="flex flex-col gap-3">
          <Link
            to="/"
            className="-m-1 inline-flex min-h-11 w-fit items-center rounded-xl p-1"
            aria-label={t("common.goHome")}
            onClick={() => {
              if (onHome) window.scrollTo({ top: 0 });
            }}
          >
            <Logo size={34} tagline />
          </Link>
          <p className="max-w-[48ch] text-sm leading-relaxed text-slate-600">
            {t("marketing.footerDisclaimer")} {t("marketing.footerEmergency")}
          </p>
        </div>

        <nav aria-label={t("marketing.footerLinksLabel")}>
          <ul className="-mx-2 grid grid-cols-2 gap-x-6 sm:flex sm:flex-wrap sm:gap-x-2">
            <li>
              <Link to="/privacy" className={footerLink}>
                {t("legal.privacyTitle")}
              </Link>
            </li>
            <li>
              <Link to="/terms" className={footerLink}>
                {t("legal.termsTitle")}
              </Link>
            </li>
            <li>
              <Link to="/login" className={footerLink}>
                {t("common.signIn")}
              </Link>
            </li>
            <li>
              <Link to="/register" className={footerLink}>
                {t("common.signUp")}
              </Link>
            </li>
          </ul>
        </nav>
      </div>
      <div className={cn(container, "border-t border-slate-200/70 py-5")}>
        <p className="text-sm text-slate-600">{t("marketing.footerRights", { year })}</p>
      </div>
    </footer>
  );
}
