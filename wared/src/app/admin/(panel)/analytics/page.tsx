import { BarChart } from '@/components/admin/BarChart';
import { AdminHeader, Filters, Notice } from '@/components/admin/ui';
import { requireStaff } from '@/lib/admin/auth';
import { analyticsOverview } from '@/lib/admin/queries';

export const metadata = { title: 'الإحصائيات' };

const fmt = new Intl.NumberFormat('ar-SA-u-nu-latn');
const DEVICES: Record<string, string> = { mobile: 'جوال', tablet: 'جهاز لوحي', desktop: 'كمبيوتر', other: 'أخرى' };

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-line p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="display mt-2 text-4xl tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

function Ranked({ title, rows }: { title: string; rows: { label: string; value: number; note?: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <section className="rounded-2xl border border-line p-5">
      <h2 className="mb-4 font-bold">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">لا توجد بيانات بعد.</p>
      ) : (
        <ol className="space-y-3">
          {rows.map((r) => (
            <li key={r.label}>
              <div className="flex items-baseline justify-between gap-4 text-sm">
                <span className="min-w-0 truncate" dir="auto">
                  {r.label}
                </span>
                <span className="shrink-0 tabular-nums">
                  {fmt.format(r.value)}
                  {r.note ? <span className="text-muted"> · {r.note}</span> : null}
                </span>
              </div>
              <div className="mt-1.5 h-1 rounded-full bg-line" aria-hidden="true">
                <div className="h-full rounded-full bg-fg" style={{ width: `${(r.value / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  await requireStaff('analytics.read');
  const days = [7, 30, 90].includes(Number((await searchParams).days)) ? Number((await searchParams).days) : 30;
  const data = await analyticsOverview(days);
  return (
    <>
      <AdminHeader title="الإحصائيات" description="أرقام فعلية من زيارات الموقع وتشغيل الحلقات، بدون أدوات تتبع خارجية. لا تشمل الاستماع عبر سبوتيفاي أو آبل." />
      <Filters
        base="/admin/analytics"
        param="days"
        current={String(days)}
        options={[
          { value: '7', label: '7 أيام' },
          { value: '30', label: '30 يومًا' },
          { value: '90', label: '90 يومًا' },
        ]}
      />
      {!data ? (
        <Notice>لا يمكن تحميل الإحصائيات الآن. تأكد من ربط قاعدة البيانات.</Notice>
      ) : (
        <div className="space-y-8">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="مشاهدات الصفحات" value={fmt.format(data.totals.page_views)} />
            <Stat label="مرات التشغيل" value={fmt.format(data.totals.plays)} />
            <Stat label="مستمعون مختلفون" value={fmt.format(data.totals.listeners)} hint="حسب معرّف مجهول في المتصفح" />
            <Stat
              label="نسبة الإكمال"
              value={data.totals.plays ? `${Math.round((data.totals.completions / data.totals.plays) * 100)}%` : '—'}
              hint="تشغيل وصل إلى 95% من الحلقة"
            />
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            <BarChart title="مشاهدات الصفحات يوميًا" data={data.daily.map((d) => ({ label: d.day, value: d.page_views }))} />
            <BarChart title="التشغيل يوميًا" data={data.daily.map((d) => ({ label: d.day, value: d.plays }))} />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Ranked
              title="الحلقات الأكثر تشغيلًا"
              rows={data.top_episodes.map((e) => ({ label: e.title, value: Number(e.plays), note: `${fmt.format(Number(e.completions))} إكمال` }))}
            />
            <Ranked title="الصفحات الأكثر زيارة" rows={data.top_paths.map((p) => ({ label: p.path, value: Number(p.views) }))} />
            <Ranked title="مصادر الزيارات" rows={data.referrers.map((r) => ({ label: r.host, value: Number(r.visits) }))} />
            <Ranked
              title="الأجهزة"
              rows={Object.entries(data.devices)
                .map(([k, v]) => ({ label: DEVICES[k] ?? k, value: Number(v) }))
                .sort((a, b) => b.value - a.value)}
            />
          </div>
          <p className="text-sm text-muted">
            مشاركات: {fmt.format(data.totals.shares)} · اشتراكات النشرة من الموقع: {fmt.format(data.totals.newsletter_signups)}
          </p>
        </div>
      )}
    </>
  );
}
