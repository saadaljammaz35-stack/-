import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { Link } from "react-router";
import { LanguageToggle } from "@/components/brand/LanguageToggle";
import { Logo } from "@/components/brand/Logo";
import { Sheet } from "@/components/ui";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/cn";
import { hasStoredSession } from "@/lib/storage";
import { useReducedMotion } from "./motion";
import { SectionLink } from "./SectionLink";
import { NAV_SECTIONS, scrollToSection } from "./sections";
import { container, mkButton } from "./styles";

/** The section currently under the upper part of the viewport (landing page only). */
function useActiveSection(enabled: boolean): string | null {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled || typeof IntersectionObserver === "undefined") return;
    const elements = NAV_SECTIONS.map(({ id }) => document.getElementById(id)).filter(
      (element): element is HTMLElement => element !== null,
    );
    if (elements.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const hit = entries.find((entry) => entry.isIntersecting);
        if (hit) setActive(hit.target.id);
      },
      { rootMargin: "-35% 0px -60% 0px" },
    );
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [enabled]);
  return enabled ? active : null;
}

export function MarketingHeader({ onHome }: { onHome: boolean }) {
  const { t } = useI18n();
  const reduced = useReducedMotion();
  const [menuOpen, setMenuOpen] = useState(false);
  // Public pages never load Supabase just to label a link.
  const [signedIn] = useState(hasStoredSession);
  const active = useActiveSection(onHome);

  const accountLink = signedIn
    ? { to: "/app", label: t("marketing.ctaDashboard") }
    : { to: "/login", label: t("marketing.ctaSignIn") };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-canvas/85 pt-safe backdrop-blur-md">
      <div className={cn(container, "flex min-h-16 items-center gap-2")}>
        <Link
          to="/"
          className="-m-1 inline-flex min-h-11 items-center rounded-xl p-1"
          aria-label={t("common.goHome")}
          onClick={(event) => {
            if (!onHome) return;
            event.preventDefault();
            scrollToSection("home", { reduced });
          }}
        >
          <Logo size={32} />
        </Link>

        <nav aria-label={t("marketing.navLabel")} className="ms-4 hidden lg:block">
          <ul className="flex items-center gap-0.5">
            {NAV_SECTIONS.map(({ id, label }) => (
              <li key={id}>
                <SectionLink
                  to={id}
                  aria-current={active === id ? "true" : undefined}
                  className={cn(
                    "inline-flex min-h-11 items-center rounded-lg px-3 text-[0.9375rem] font-medium text-slate-700",
                    "aria-[current=true]:font-bold aria-[current=true]:text-primary",
                  )}
                >
                  {t(label)}
                </SectionLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ms-auto flex items-center gap-1 sm:gap-2">
          <LanguageToggle className="hidden sm:inline-flex" />
          <Link to={accountLink.to} className={mkButton("ghost", "md", "hidden md:inline-flex")}>
            {accountLink.label}
          </Link>
          <Link to="/register" className={mkButton("cta", "md")}>
            {t("marketing.ctaStart")}
          </Link>
          <button
            type="button"
            className="mk-btn mk-btn--ghost inline-flex size-11 items-center justify-center rounded-xl lg:hidden"
            aria-label={t("common.openMenu")}
            aria-expanded={menuOpen}
            aria-haspopup="dialog"
            onClick={() => setMenuOpen(true)}
          >
            <Menu className="size-6" aria-hidden="true" />
          </button>
        </div>
      </div>

      <Sheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={t("common.menu")}
        header={<Logo size={30} />}
        className="mk"
      >
        <nav aria-label={t("marketing.navLabel")} className="flex flex-col gap-1 p-3">
          <ul className="flex flex-col gap-1">
            {NAV_SECTIONS.map(({ id, label }) => (
              <li key={id}>
                <SectionLink
                  to={id}
                  onNavigate={() => setMenuOpen(false)}
                  aria-current={active === id ? "true" : undefined}
                  className="flex min-h-12 items-center rounded-xl px-3 text-base font-medium text-slate-800 hover:bg-slate-100 aria-[current=true]:bg-mint aria-[current=true]:font-bold aria-[current=true]:text-accent-strong"
                >
                  {t(label)}
                </SectionLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex flex-col gap-2 border-t border-slate-100 p-3">
          <LanguageToggle className="w-full justify-start" />
          <Link
            to={accountLink.to}
            className={mkButton("quiet", "lg", "w-full")}
            onClick={() => setMenuOpen(false)}
          >
            {accountLink.label}
          </Link>
          <Link
            to="/register"
            className={mkButton("cta", "lg", "w-full")}
            onClick={() => setMenuOpen(false)}
          >
            {t("marketing.ctaStart")}
          </Link>
        </div>
      </Sheet>
    </header>
  );
}
