import type { ReactNode } from "react";

export function PageHead({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="card stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

const TONE: Record<string, string> = {
  ready: "ok", deployed: "ok", passed: "ok", succeeded: "ok", healthy: "ok", valid: "ok", complete: "ok", ok: "ok",
  queued: "accent", running: "accent", processing: "accent", claimed: "accent", validating: "accent", pending: "accent",
  unavailable: "warn", not_evaluated: "warn", draft: "warn", degraded: "warn", unknown: "warn", cancelled: "warn", duplicate: "warn",
  failed: "bad", error: "bad", invalid: "bad", down: "bad", pii_flagged: "bad", retired: "bad",
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return <span className={`badge ${TONE[status] ?? ""}`}>{label ?? status.replace(/_/g, " ")}</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function fmtNumber(n: number | null | undefined, locale: string): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat(locale === "ar" ? "ar-SA-u-nu-latn" : "en-US").format(n);
}

export function fmtDate(d: string | Date | null | undefined, locale: string): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA-u-nu-latn-ca-gregory" : "en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(d));
}
