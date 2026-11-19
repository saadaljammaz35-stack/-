import { requireStaffPage } from '@/lib/auth/staff';
import { userDb } from '@/lib/supabase/server';
import { getLocale } from '@/lib/i18n/server';
import { adminDicts } from '@/lib/i18n/admin';
import { fmtDateTime } from '@/lib/time';
import { PageHeader } from '@/components/admin/ui';

export default async function AuditPage() {
  await requireStaffPage('audit.view', '/admin/audit');
  const locale = await getLocale();
  const a = adminDicts[locale];
  const { data } = await (await userDb()).from('audit_logs').select('id, actor_email, action, entity, entity_id, before, after, meta, created_at').order('created_at', { ascending: false }).limit(200);
  return (
    <div>
      <PageHeader title={a.audit.title} />
      <div className="glass overflow-x-auto rounded-3xl">
        <table className="w-full min-w-[720px] text-sm">
          <thead><tr className="border-b hairline text-xs text-espresso-500">{[a.audit.when, a.audit.who, a.audit.action, a.audit.entity, ''].map((h, i) => <th key={i} className="px-3 py-3 text-start">{h}</th>)}</tr></thead>
          <tbody>
            {(data ?? []).map((r) => {
              const changed = r.before && r.after ? Object.keys(r.after).filter((k) => k !== 'updated_at' && JSON.stringify(r.after[k]) !== JSON.stringify(r.before[k])) : [];
              return (
                <tr key={r.id} className="border-b hairline align-top">
                  <td className="num px-3 py-2 text-xs" dir="ltr">{fmtDateTime(r.created_at, locale)}</td>
                  <td className="px-3 py-2 text-xs" dir="ltr">{r.actor_email ?? 'system'}</td>
                  <td className="px-3 py-2 font-semibold">{r.action}</td>
                  <td className="px-3 py-2">{r.entity} <span className="num text-xs text-espresso-500">{String(r.entity_id ?? '').slice(0, 8)}</span></td>
                  <td className="px-3 py-2 text-xs text-espresso-600">{changed.length ? changed.slice(0, 6).join(', ') : r.meta ? JSON.stringify(r.meta).slice(0, 120) : ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
