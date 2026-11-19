import type { ReactNode } from 'react';

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-espresso-600">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, children, className = '', actions }: { title?: string; children: ReactNode; className?: string; actions?: ReactNode }) {
  return (
    <section className={`glass rounded-3xl p-5 ${className}`}>
      {(title || actions) && (
        <div className="mb-4 flex items-center justify-between gap-2">
          {title && <h2 className="font-bold">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

const STATUS_TONE: Record<string, string> = {
  pending_payment: 'bg-sand-300 text-espresso-700', payment_failed: 'bg-danger-500/10 text-danger-500', expired: 'bg-sand-300 text-espresso-500',
  awaiting_approval: 'bg-warn-500/15 text-[#8a5d0e]', accepted: 'bg-espresso-800 text-cream-100', preparing: 'bg-terracotta-500 text-white',
  ready: 'bg-ok-500 text-white', delivered: 'bg-ok-500/10 text-ok-500', rejected: 'bg-danger-500/10 text-danger-500', cancelled: 'bg-danger-500/10 text-danger-500',
  paid: 'bg-ok-500/10 text-ok-500', authorized: 'bg-warn-500/15 text-[#8a5d0e]', refund_pending: 'bg-warn-500/15 text-[#8a5d0e]', refunded: 'bg-sand-300 text-espresso-700',
  voided: 'bg-sand-300 text-espresso-700', failed: 'bg-danger-500/10 text-danger-500', unpaid: 'bg-sand-300 text-espresso-700', not_required: 'bg-sand-300 text-espresso-700',
  sent: 'bg-ok-500/10 text-ok-500', skipped: 'bg-sand-300 text-espresso-600', pending: 'bg-warn-500/15 text-[#8a5d0e]',
};

export function Badge({ value, label }: { value: string; label?: string }) {
  return <span className={`chip whitespace-nowrap ${STATUS_TONE[value] ?? 'bg-sand-300 text-espresso-700'}`} data-status={value}>{label ?? value}</span>;
}

export function Stat({ label, value, hint, tone = 'default' }: { label: string; value: ReactNode; hint?: string; tone?: 'default' | 'dark' | 'accent' }) {
  const cls = tone === 'dark' ? 'bg-espresso-900 text-cream-100' : tone === 'accent' ? 'bg-terracotta-500 text-white' : 'glass';
  return (
    <div className={`rounded-3xl p-4 ${cls}`}>
      <p className={`text-xs font-semibold ${tone === 'default' ? 'text-espresso-500' : 'opacity-75'}`}>{label}</p>
      <p className="num mt-1 text-2xl font-bold">{value}</p>
      {hint && <p className={`mt-0.5 text-xs ${tone === 'default' ? 'text-espresso-500' : 'opacity-70'}`}>{hint}</p>}
    </div>
  );
}
