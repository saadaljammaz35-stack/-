import { requirePage } from '@/lib/auth/page';
import { withOrg } from '@/lib/db';
import { getPrefs } from '@/lib/prefs';
import { can } from '@/lib/auth/permissions';
import { dict, formatDate, label, tr } from '@/lib/i18n';
import { Card, Flash, PageHeader, StatusBadge } from '@/components/os/ui';

export default async function AutomationsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await requirePage();
  const { locale } = await getPrefs();
  const t = dict(locale);
  const rows = await withOrg(session, (q) => q.query<{ id: string; kind: string; enabled: boolean; cron: string; timezone: string; uses_ai: boolean; max_cost_usd: number; next_run_at: Date | null; last_run_at: Date | null; last_status: string | null; last_error: string | null }>(
    'select id, kind, enabled, cron, timezone, uses_ai, max_cost_usd::float8, next_run_at, last_run_at, last_status, last_error from ward.automations order by kind'));
  const write = can(session.role, 'settings.write');
  return (
    <div className="stack">
      <Flash params={await searchParams} />
      <PageHeader title={t.nav.automations} subtitle={tr(locale, 'مهام دورية تعمل في الخلفية عبر طابور دائم في قاعدة البيانات — لا تعتمد على بقاء المتصفح مفتوحًا. كلها معطلة افتراضيًا، ولكل منها سقف تكلفة.', 'Periodic jobs run in the background from a durable database queue — no browser needed. All are off by default and each has a cost cap.')} />
      <div className="grid">
        {rows.map((a) => (
          <Card key={a.id} title={label(locale, a.kind)} action={<StatusBadge status={a.enabled ? 'active' : 'disabled'} locale={locale} />}>
            <form action={`/api/os/automations/${a.id}`} method="post" className="stack">
              <input type="hidden" name="enabled_form" value="1" />
              <fieldset disabled={!write} className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
                <label className="row small"><input type="checkbox" name="enabled" defaultChecked={a.enabled} />{tr(locale, 'مفعّلة', 'Enabled')}</label>
                <label className="field">cron ({a.timezone})<input className="input ltr" name="cron" defaultValue={a.cron} /></label>
                <div className="row">
                  <label className="row small"><input type="checkbox" name="uses_ai" defaultChecked={a.uses_ai} />{tr(locale, 'يستخدم الذكاء', 'Uses AI')}</label>
                  <label className="field" style={{ flex: 1 }}>{tr(locale, 'سقف التكلفة USD', 'Cost cap USD')}<input className="input ltr" type="number" step="0.05" min="0" max="20" name="max_cost_usd" defaultValue={a.max_cost_usd} /></label>
                </div>
                {write && <div><button className="btn btn-sm">{tr(locale, 'حفظ', 'Save')}</button></div>}
              </fieldset>
            </form>
            <div className="small faint" style={{ marginTop: 10 }}>
              {tr(locale, 'التالي', 'Next')}: {formatDate(locale, a.next_run_at, true)} · {tr(locale, 'الأخير', 'Last')}: {formatDate(locale, a.last_run_at, true)} {a.last_status ? `(${a.last_status})` : ''}
              {a.last_error && <div style={{ color: 'var(--bad)' }}>{a.last_error}</div>}
            </div>
            {write && a.enabled && <form action={`/api/os/automations/${a.id}/run`} method="post" style={{ marginTop: 8 }}><button className="btn btn-sm btn-ghost">{tr(locale, 'تشغيل الآن', 'Run now')}</button></form>}
          </Card>
        ))}
      </div>
    </div>
  );
}
