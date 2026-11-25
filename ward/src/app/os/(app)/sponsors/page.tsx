import Link from 'next/link';
import { requirePage } from '@/lib/auth/page';
import { withOrg } from '@/lib/db';
import { getPrefs } from '@/lib/prefs';
import { can } from '@/lib/auth/permissions';
import { dict, formatDate, money, tr } from '@/lib/i18n';
import { Card, Flash, PageHeader, StatusBadge } from '@/components/os/ui';

export default async function SponsorsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await requirePage();
  const { locale } = await getPrefs();
  const t = dict(locale);
  const sponsors = await withOrg(session, (q) => q.query<{ id: string; name: string; name_pending: boolean; logo_file_id: string | null; category: string | null; status: string; value_amount: number | null; currency: string; agreement_end: Date | null; episodes: number; deliverables: number; overdue: number }>(
    `select s.id, s.name, s.name_pending, s.logo_file_id, s.category, s.status, s.value_amount::float8, s.currency, s.agreement_end,
            (select count(*)::int from ward.episode_sponsors es where es.sponsor_id = s.id) as episodes,
            (select count(*)::int from ward.sponsorship_deliverables d where d.sponsor_id = s.id) as deliverables,
            (select count(*)::int from ward.sponsorship_deliverables d where d.sponsor_id = s.id and d.status = 'pending' and d.due_at < now()) as overdue
       from ward.sponsors s order by s.created_at`));
  return (
    <div className="stack">
      <Flash params={await searchParams} />
      <PageHeader title={t.nav.sponsors} subtitle={tr(locale, 'السجلات قابلة للتعديل. لا تُعتبر أي شراكة أو قيمة مؤكدة قبل توثيق الاتفاق.', 'Editable records. No partnership or amount is treated as confirmed until the agreement is documented.')} />
      <Card>
        <div className="table-wrap"><table className="table">
          <thead><tr><th>{tr(locale, 'العلامة', 'Brand')}</th><th>{tr(locale, 'الفئة', 'Category')}</th><th>{tr(locale, 'القيمة', 'Value')}</th><th>{tr(locale, 'نهاية الاتفاق', 'Ends')}</th><th>{tr(locale, 'حلقات', 'Episodes')}</th><th>{tr(locale, 'حقوق', 'Rights')}</th><th>{t.common.status}</th></tr></thead>
          <tbody>
            {sponsors.map((s) => (
              <tr key={s.id}>
                <td><Link href={`/os/sponsors/${s.id}`} className="row" style={{ fontWeight: 500 }}>
                  {s.logo_file_id ? (
                    // Private, session-authenticated file: the Next image optimizer cannot fetch it.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/os/files/${s.logo_file_id}`} alt="" width={28} height={28} style={{ borderRadius: 6, objectFit: 'contain', background: 'var(--raised)' }} />
                  ) : null}
                  {s.name}{s.name_pending && <span className="small faint"> ({tr(locale, 'الاسم غير محدد', 'name TBD')})</span>}
                </Link></td>
                <td className="small">{s.category ?? '—'}</td>
                <td className="small ltr">{s.value_amount != null ? money(s.value_amount, s.currency) : '—'}</td>
                <td className="small">{formatDate(locale, s.agreement_end)}</td>
                <td className="small">{s.episodes}</td>
                <td className="small">{s.deliverables}{s.overdue ? <span style={{ color: 'var(--bad)' }}> · {s.overdue}!</span> : null}</td>
                <td><StatusBadge status={s.status} locale={locale} /></td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </Card>
      {can(session.role, 'sponsors.write') && (
        <Card title={tr(locale, 'إضافة علامة', 'Add brand')}>
          <form action="/api/os/sponsors" method="post" className="row">
            <input className="input" style={{ flex: 1 }} name="name" required maxLength={200} placeholder={tr(locale, 'اسم العلامة', 'Brand name')} />
            <button className="btn btn-primary">{tr(locale, 'إضافة', 'Add')}</button>
          </form>
        </Card>
      )}
    </div>
  );
}
