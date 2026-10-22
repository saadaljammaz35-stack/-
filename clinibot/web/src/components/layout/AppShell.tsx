import { Suspense, useEffect, useRef, useState, type MouseEvent } from "react";
import { Menu as MenuIcon } from "lucide-react";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import { LanguageToggle } from "@/components/brand/LanguageToggle";
import { Logo } from "@/components/brand/Logo";
import { Sheet } from "@/components/ui";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/cn";
import { hasRole } from "@/org/roles";
import { useOrg } from "@/org/useOrg";
import { ErrorBoundary } from "./ErrorBoundary";
import { FullPageSpinner } from "./FullPageSpinner";
import { NAV_ITEMS } from "./nav";
import { OrgSwitcher } from "./OrgSwitcher";
import { UserMenu } from "./UserMenu";

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useI18n();
  const { role } = useOrg();
  return (
    <ul className="flex flex-col gap-0.5">
      {NAV_ITEMS.filter((item) => !item.roles || hasRole(role, item.roles)).map((item) => (
        <li key={item.to}>
          <NavLink
            to={item.to}
            end={item.to === "/app"}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "flex min-h-11 items-center gap-3 rounded-xl px-3 text-[0.9375rem] font-medium transition-colors",
                isActive
                  ? "bg-primary-soft font-bold text-primary"
                  : "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon
                  className={cn("size-5 shrink-0", isActive ? "text-primary" : "text-slate-500")}
                  aria-hidden="true"
                />
                <span className="truncate">{t(item.label)}</span>
                {isActive && (
                  <span className="ms-auto size-1.5 rounded-full bg-accent" aria-hidden="true" />
                )}
              </>
            )}
          </NavLink>
        </li>
      ))}
    </ul>
  );
}

/**
 * Signed-in layout for /app/*: sidebar on the start side from `lg`, a top bar
 * with a slide-over menu below that. Pages render in <Outlet />.
 */
export function AppShell() {
  const { t } = useI18n();
  const { current } = useOrg();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const firstRender = useRef(true);

  // New page: start at the top, and move focus to the page so screen readers notice the
  // change. (The phone menu closes from its own links.)
  useEffect(() => {
    window.scrollTo(0, 0);
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const main = mainRef.current;
    const active = document.activeElement;
    // Keep focus when it is still on a live element inside the page (e.g. a tab or filter
    // link that stayed mounted). Otherwise it sat on the sidebar or the hamburger, or the
    // clicked link unmounted (body): move it to the page.
    if (main && !(active && active !== document.body && main.contains(active))) {
      main.focus({ preventScroll: true });
    }
  }, [location.pathname]);

  function skipToMain(event: MouseEvent<HTMLAnchorElement>) {
    const main = mainRef.current;
    if (!main) return;
    event.preventDefault();
    main.focus();
  }

  return (
    <div className="min-h-dvh bg-canvas">
      <a
        href="#main"
        onClick={skipToMain}
        className="sr-only z-[70] rounded-xl bg-primary px-4 py-3 font-bold text-white focus:not-sr-only focus:fixed focus:start-3 focus:top-3"
      >
        {t("common.skipToContent")}
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 start-0 z-30 hidden w-64 flex-col border-e border-slate-200 bg-white lg:flex">
        <div className="flex h-16 shrink-0 items-center px-5">
          <Link to="/app" className="-m-1 rounded-xl p-1">
            <Logo size={32} />
          </Link>
        </div>
        <div className="px-3">
          <OrgSwitcher />
        </div>
        <nav
          aria-label={t("common.mainNavigation")}
          className="min-h-0 flex-1 overflow-y-auto px-3 py-4"
        >
          <NavList />
        </nav>
        <div className="flex items-center gap-1 border-t border-slate-200 p-3">
          <UserMenu placement="top" showName />
          <LanguageToggle compact />
        </div>
      </aside>

      {/* Phone / tablet top bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 pt-safe backdrop-blur lg:hidden">
        <div className="flex min-h-14 items-center gap-1 px-[max(0.5rem,env(safe-area-inset-left,0px),env(safe-area-inset-right,0px))]">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="inline-flex size-11 items-center justify-center rounded-xl text-slate-700 hover:bg-slate-100"
            aria-label={t("common.openMenu")}
            aria-expanded={menuOpen}
          >
            <MenuIcon className="size-6" aria-hidden="true" />
          </button>
          <Link to="/app" className="rounded-xl p-1">
            <Logo size={28} />
          </Link>
          <div className="ms-auto flex items-center">
            <LanguageToggle compact />
            <UserMenu />
          </div>
        </div>
      </header>

      <Sheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={t("common.menu")}
        header={<Logo size={28} />}
      >
        <div className="p-3">
          <OrgSwitcher onSwitched={() => setMenuOpen(false)} />
        </div>
        <nav aria-label={t("common.mainNavigation")} className="px-3 pb-4">
          <NavList onNavigate={() => setMenuOpen(false)} />
        </nav>
      </Sheet>

      <div className="lg:ps-64">
        <main
          ref={mainRef}
          id="main"
          tabIndex={-1}
          className="mx-auto w-full max-w-6xl px-4 pt-6 pb-[max(2rem,env(safe-area-inset-bottom))] outline-none sm:px-6 lg:px-10 lg:pt-10"
        >
          <ErrorBoundary resetKey={location.pathname}>
            <Suspense fallback={<FullPageSpinner inline />}>
              {/* Keyed by clinic: switching clinics remounts the page so no local state (a
                  one-time verify token, a test transcript, typed credentials) carries over. */}
              <Outlet key={current?.id} />
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
