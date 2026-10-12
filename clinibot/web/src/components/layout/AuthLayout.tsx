import type { ReactNode } from "react";
import { Link } from "react-router";
import { CircleCheck } from "lucide-react";
import { LanguageToggle } from "@/components/brand/LanguageToggle";
import { Logo } from "@/components/brand/Logo";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/cn";

/**
 * Frame for sign-in, registration, password and onboarding screens: a form
 * column plus (on large screens) a brand panel on the end side.
 */
export function AuthLayout({ children, aside = true }: { children: ReactNode; aside?: boolean }) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-dvh bg-canvas">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-16 items-center justify-between gap-3 px-4 pt-safe sm:px-8">
          <Link to="/" className="-m-1 rounded-xl p-1" aria-label={t("common.goHome")}>
            <Logo size={34} />
          </Link>
          <LanguageToggle />
        </header>
        <main
          id="main"
          className="flex flex-1 items-start justify-center px-4 pt-6 pb-[max(2rem,env(safe-area-inset-bottom))] sm:items-center sm:px-8 sm:py-12"
        >
          <div className={cn("w-full", aside ? "max-w-md" : "max-w-2xl")}>{children}</div>
        </main>
      </div>
      {aside && <BrandAside />}
    </div>
  );
}

function BrandAside() {
  const { t } = useI18n();
  const points = [t("auth.asidePoint1"), t("auth.asidePoint2"), t("auth.asidePoint3")];
  return (
    <aside className="relative hidden w-[40%] max-w-xl overflow-hidden bg-linear-to-br from-navy-900 via-primary to-accent-strong text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -end-24 -top-24 size-80 rounded-full bg-white/5"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -start-16 bottom-10 size-56 rounded-full bg-accent/20 blur-2xl"
      />
      <Logo variant="inverse" tagline size={44} className="relative" />
      <div className="relative">
        <h2 className="text-3xl leading-snug font-extrabold">{t("auth.asideTitle")}</h2>
        <ul className="mt-8 flex flex-col gap-4">
          {points.map((point) => (
            <li
              key={point}
              className="flex items-start gap-3 text-[0.9375rem] leading-relaxed text-white/90"
            >
              <CircleCheck className="mt-0.5 size-5 shrink-0 text-emerald-300" aria-hidden="true" />
              <span>{point}</span>
            </li>
          ))}
        </ul>
      </div>
      <p className="relative text-sm text-white/60">© {new Date().getFullYear()} CliniBot</p>
    </aside>
  );
}

export interface AuthCardProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Icon above the title (status screens such as "check your email"). */
  icon?: ReactNode;
  children?: ReactNode;
  /** Links under the card ("Already have an account? Sign in"). */
  footer?: ReactNode;
}

export function AuthCard({ title, subtitle, icon, children, footer }: AuthCardProps) {
  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card sm:p-8">
        {icon && <div className="mb-5">{icon}</div>}
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-2 leading-relaxed text-slate-600">{subtitle}</p>}
        {children && <div className="mt-6">{children}</div>}
      </div>
      {footer && <div className="text-center text-sm text-slate-600">{footer}</div>}
    </div>
  );
}

/** Round tinted icon used at the top of status cards. */
export function StatusIcon({
  children,
  tone = "brand",
}: {
  children: ReactNode;
  tone?: "brand" | "success" | "warning";
}) {
  return (
    <span
      className={cn(
        "flex size-14 items-center justify-center rounded-2xl",
        tone === "brand" && "bg-primary-soft text-primary",
        tone === "success" && "bg-mint text-accent-strong",
        tone === "warning" && "bg-amber-50 text-amber-600",
      )}
    >
      {children}
    </span>
  );
}
