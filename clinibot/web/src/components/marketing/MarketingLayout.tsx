import "./marketing.css";
import { useEffect, type MouseEvent, type ReactNode } from "react";
import { useI18n } from "@/i18n";
import { OnHomeContext } from "./context";
import { MarketingFooter } from "./MarketingFooter";
import { MarketingHeader } from "./MarketingHeader";
import { usePageVisible } from "./motion";

interface MarketingLayoutProps {
  children: ReactNode;
  /** True on the landing page: header links scroll within the page. */
  onHome?: boolean;
}

/**
 * Shell for the public site (landing page and legal pages): skip link, sticky
 * header, <main id="main">, footer, and the fixed background glow behind
 * everything. While mounted it marks <html> so page-level rules in
 * marketing.css (no horizontal scroll) apply only here.
 */
export function MarketingLayout({ children, onHome = false }: MarketingLayoutProps) {
  const { t } = useI18n();
  const visible = usePageVisible();

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("mk-page");
    return () => root.classList.remove("mk-page");
  }, []);

  function skipToMain(event: MouseEvent<HTMLAnchorElement>) {
    const main = document.getElementById("main");
    if (!main) return;
    event.preventDefault();
    main.focus();
  }

  return (
    <OnHomeContext value={onHome}>
      <div
        className="mk relative isolate flex min-h-dvh flex-col text-slate-900"
        data-tab={visible ? "visible" : "hidden"}
      >
        <div className="mk-ambient" aria-hidden="true">
          <div className="mk-ambient__glow mk-ambient__glow--mint" />
          <div className="mk-ambient__glow mk-ambient__glow--navy" />
        </div>

        <a
          href="#main"
          onClick={skipToMain}
          className="sr-only z-50 rounded-xl bg-white px-4 py-3 font-bold text-primary shadow-overlay focus:not-sr-only focus:fixed focus:start-3 focus:top-[calc(0.75rem+env(safe-area-inset-top,0px))]"
        >
          {t("common.skipToContent")}
        </a>

        <MarketingHeader onHome={onHome} />

        <main id="main" tabIndex={-1} className="flex-1 outline-none">
          {children}
        </main>

        <MarketingFooter onHome={onHome} />
      </div>
    </OnHomeContext>
  );
}
