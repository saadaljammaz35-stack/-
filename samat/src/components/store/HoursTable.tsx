import type { Dict } from '@/lib/i18n';

const ORDER = ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'] as const;

export function HoursTable({ hours, t, dark = true }: { hours: Record<string, { open: string; close: string }[]>; t: Dict; dark?: boolean }) {
  const configured = Object.values(hours ?? {}).some((v) => v?.length);
  if (!configured) return <p className={`text-sm ${dark ? 'text-cream-300/70' : 'text-espresso-600'}`}>—</p>;
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm">
      {ORDER.map((d) => (
        <div key={d} className="contents">
          <dt className={dark ? 'text-cream-300/70' : 'text-espresso-600'}>{t.days[d]}</dt>
          <dd className="num" dir="ltr">
            {hours[d]?.length ? hours[d].map((s) => `${s.open}–${s.close}`).join(' · ') : '—'}
          </dd>
        </div>
      ))}
    </dl>
  );
}
