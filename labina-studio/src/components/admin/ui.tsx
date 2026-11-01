import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { STATUS_META } from "@/lib/constants";
import type { BookingStatus } from "@/lib/types";

export function AdminPage({ title, description, actions, children }: { title: string; description?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="mb-6 flex flex-col gap-4 md:mb-8 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-plum md:text-3xl">{title}</h1>
          {description && <p className="mt-1.5 text-ink-soft">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

export function Card({ title, description, actions, children, className }: { title?: string; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-3xl bg-paper p-5 shadow-soft md:p-6", className)}>
      {(title || actions) && (
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && <h2 className="font-display text-lg font-semibold text-plum">{title}</h2>}
            {description && <p className="mt-1 text-sm text-ink-soft">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatusBadge({ status }: { status: BookingStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold", meta.className)}>
      <span className={cn("size-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  );
}

export function StatCard({ label, value, tone = "paper", hint }: { label: string; value: ReactNode; tone?: "paper" | "coral" | "sun" | "teal" | "lavender" | "plum"; hint?: string }) {
  const tones = {
    paper: "bg-paper text-plum",
    coral: "bg-coral text-ink",
    sun: "bg-sun text-ink",
    teal: "bg-teal text-ink",
    lavender: "bg-lavender text-ink",
    plum: "bg-plum text-cream",
  };
  return (
    <div className={cn("rounded-3xl p-5 shadow-soft", tones[tone])}>
      <p className="text-sm font-medium opacity-80">{label}</p>
      <p className="mt-2 font-display text-3xl font-bold md:text-4xl">{value}</p>
      {hint && <p className="mt-1 text-xs opacity-70">{hint}</p>}
    </div>
  );
}

export function EmptyState({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-3xl border-2 border-dashed border-line px-6 py-12 text-center">
      <div className="mb-4 flex items-end gap-1.5" aria-hidden>
        <span className="h-5 w-4 rounded-md bg-coral" />
        <span className="h-8 w-4 rounded-md bg-sun" />
        <span className="h-6 w-4 rounded-md bg-teal" />
      </div>
      <p className="font-display text-lg font-semibold text-plum">{title}</p>
      {text && <p className="mt-1 max-w-md text-sm text-ink-soft">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function NoAccess() {
  return (
    <div className="mx-auto max-w-lg">
      <EmptyState title="هذه الصفحة للمسؤولين فقط" text="حسابك بصلاحية «موظف»، ويمكنه إدارة الحجوزات والعملاء والرسائل فقط." />
    </div>
  );
}
