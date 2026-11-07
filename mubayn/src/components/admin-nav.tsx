import Link from "next/link";
import { adminT, type AKey } from "@/lib/admin-i18n";
import type { Locale } from "@/lib/i18n";

const LINKS: [string, AKey][] = [
  ["/admin", "nav_overview"], ["/admin/inspections", "nav_inspections"], ["/admin/jobs", "nav_jobs"], ["/admin/users", "nav_customers"],
  ["/admin/errors", "nav_errors"], ["/admin/messages", "nav_messages"], ["/admin/settings", "nav_limits"], ["/admin/audit", "nav_audit"],
];

export function AdminShell({ title, locale, children }: { title: string; locale: Locale; children: React.ReactNode }) {
  const t = adminT(locale);
  return (
    <div className="wrap page" dir={locale === "ar" ? "rtl" : "ltr"} lang={locale} style={{ maxWidth: 1240 }}>
      <nav className="row small" style={{ gap: 4, marginBottom: 18, borderBottom: "1px solid var(--line)", paddingBottom: 10 }}>
        {LINKS.map(([href, key]) => <Link key={href} href={href} className="btn btn-sm btn-ghost" style={{ border: 0 }}>{t(key)}</Link>)}
      </nav>
      <h1 style={{ fontSize: "1.8rem" }}>{title}</h1>
      {children}
    </div>
  );
}

export const fmtDate = (d: Date | string | null) => (d ? new Date(d).toISOString().replace("T", " ").slice(0, 16) + " UTC" : "—");
export const usd = (micros: number | null | undefined) => `$${((micros ?? 0) / 1_000_000).toFixed(2)}`;
