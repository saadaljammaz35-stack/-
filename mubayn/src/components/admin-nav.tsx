import Link from "next/link";

const LINKS = [
  ["/admin", "Overview"], ["/admin/inspections", "Inspections"], ["/admin/jobs", "AI jobs"], ["/admin/users", "Customers"],
  ["/admin/errors", "Errors"], ["/admin/messages", "Messages"], ["/admin/settings", "Limits"], ["/admin/audit", "Audit log"],
] as const;

export function AdminShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="wrap page" dir="ltr" lang="en" style={{ maxWidth: 1240 }}>
      <nav className="row small" style={{ gap: 4, marginBottom: 18, borderBottom: "1px solid var(--line)", paddingBottom: 10 }}>
        {LINKS.map(([href, label]) => <Link key={href} href={href} className="btn btn-sm btn-ghost" style={{ border: 0 }}>{label}</Link>)}
      </nav>
      <h1 style={{ fontSize: "1.8rem" }}>{title}</h1>
      {children}
    </div>
  );
}

export const fmtDate = (d: Date | string | null) => (d ? new Date(d).toISOString().replace("T", " ").slice(0, 16) + " UTC" : "—");
export const usd = (micros: number | null | undefined) => `$${((micros ?? 0) / 1_000_000).toFixed(2)}`;
