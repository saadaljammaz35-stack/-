import Link from 'next/link';
import type { ReactNode } from 'react';
import { STATUS_LABELS } from '@/lib/admin/permissions';

export function AdminHeader({ title, description, actions, back }: { title: string; description?: string; actions?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <header className="mb-10 flex flex-wrap items-end justify-between gap-6">
      <div>
        {back && (
          <Link href={back.href} className="mb-3 inline-block text-sm text-muted hover:text-fg">
            → {back.label}
          </Link>
        )}
        <h1 className="display text-[clamp(1.875rem,4vw,2.75rem)]">{title}</h1>
        {description && <p className="mt-2 max-w-2xl leading-7 text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
    </header>
  );
}

const STATUS_STYLE: Record<string, string> = {
  draft: 'border-line-strong text-muted',
  review: 'border-sand text-accent',
  scheduled: 'border-fg text-fg',
  published: 'border-fg bg-fg text-bg',
  archived: 'border-line text-muted line-through',
};

export function StatusBadge({ status, publishedAt }: { status: keyof typeof STATUS_LABELS; publishedAt?: string | null }) {
  const live = (status === 'published' || status === 'scheduled') && publishedAt && new Date(publishedAt) <= new Date();
  const label = status === 'scheduled' && live ? 'منشور (مجدول سابقًا)' : STATUS_LABELS[status];
  return <span className={`inline-flex shrink-0 rounded-full border px-2.5 py-0.5 text-xs ${STATUS_STYLE[live ? 'published' : status]}`}>{label}</span>;
}

export function Notice({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'warn' }) {
  return <div className={`rounded-2xl border p-5 leading-7 ${tone === 'warn' ? 'border-sand' : 'border-line text-muted'}`}>{children}</div>;
}

export function NotConfigured() {
  return (
    <Notice tone="warn">
      قاعدة البيانات غير مربوطة. أضف <code dir="ltr">NEXT_PUBLIC_SUPABASE_URL</code> و<code dir="ltr">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> و
      <code dir="ltr">SUPABASE_SECRET_KEY</code> كما في README.
    </Notice>
  );
}

export function RowList({ children, empty }: { children: ReactNode[]; empty: string }) {
  if (children.length === 0) return <p className="border-y border-line py-10 text-muted">{empty}</p>;
  return <ul className="divide-y divide-line border-y border-line">{children}</ul>;
}

export function Row({ href, title, meta, aside }: { href?: string; title: ReactNode; meta?: ReactNode; aside?: ReactNode }) {
  const body = (
    <>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{title}</p>
        {meta && <p className="mt-1 truncate text-sm text-muted">{meta}</p>}
      </div>
      {aside && <div className="flex shrink-0 items-center gap-3">{aside}</div>}
    </>
  );
  return (
    <li>
      {href ? (
        <Link href={href} className="flex items-center gap-4 px-1 py-4 transition-colors hover:bg-surface sm:px-3">
          {body}
        </Link>
      ) : (
        <div className="flex items-center gap-4 px-1 py-4 sm:px-3">{body}</div>
      )}
    </li>
  );
}

export function Filters({ base, current, options, param = 'status' }: { base: string; current?: string; options: { value: string; label: string }[]; param?: string }) {
  const cls = 'rounded-full border px-3.5 py-1.5 text-sm transition-colors aria-[current=page]:border-fg aria-[current=page]:bg-fg aria-[current=page]:text-bg border-line hover:border-line-strong';
  return (
    <nav aria-label="تصفية" className="mb-6 flex flex-wrap gap-2">
      <Link href={base} aria-current={!current ? 'page' : undefined} className={cls}>
        الكل
      </Link>
      {options.map((o) => (
        <Link key={o.value} href={`${base}?${param}=${o.value}`} aria-current={current === o.value ? 'page' : undefined} className={cls}>
          {o.label}
        </Link>
      ))}
    </nav>
  );
}

export function formatAdminDate(value: string | null | undefined): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Riyadh' }).format(new Date(value));
}
