import { requirePage } from '@/lib/auth/page';
import { withOrg } from '@/lib/db';
import { getPrefs } from '@/lib/prefs';
import { can } from '@/lib/auth/permissions';
import { dict, formatDate, label, tr } from '@/lib/i18n';
import { getSettings, PROVIDERS } from '@/lib/settings';
import { configuredProviders } from '@/lib/ai/gateway';
import { env } from '@/lib/env';
import { Card, Flash, PageHeader, StatusBadge } from '@/components/os/ui';

const KEY_ENV: Record<string, string> = { openai: 'OPENAI_API_KEY', anthropic: 'ANTHROPIC_API_KEY', gemini: 'GEMINI_API_KEY', deepseek: 'DEEPSEEK_API_KEY', ollama: 'OLLAMA_BASE_URL' };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await requirePage();
  const { locale } = await getPrefs();
  const t = dict(locale);
  const d = await withOrg(session, async (q) => ({
    s: await getSettings(q, session.orgId),
    integrations: await q.query<{ provider: string; status: string; last_checked_at: Date | null; last_error: string | null }>('select provider, status, last_checked_at, last_error from ward.integrations'),
    members: await q.query<{ user_id: string; name: string; email: string; role: string; last_login_at: Date | null }>(
      `select m.user_id, u.name, u.email, m.role, u.last_login_at from ward.organization_members m join ward.users u on u.id = m.user_id order by m.created_at`),
  }));
  const owner = can(session.role, 'settings.write');
  const live = new Set(configuredProviders());
  const prices = Object.entries(d.s['ai.prices']).map(([k, v]) => `${k} ${v.input} ${v.output}${v.cacheRead !== undefined ? ` ${v.cacheRead}` : ''}`).join('\n');
  return (
    <div className="stack">
      <Flash params={await searchParams} />
      <PageHeader title={t.nav.settings} />
      <Card id="account" title={tr(locale, `حسابي — ${session.email}`, `My account — ${session.email}`)}>
        <form action="/api/os/account/password" method="post" className="grid">
          <input className="input ltr" type="password" name="current_password" required autoComplete="current-password" placeholder={tr(locale, 'كلمة المرور الحالية', 'Current password')} />
          <input className="input ltr" type="password" name="new_password" required minLength={12} autoComplete="new-password" placeholder={tr(locale, 'كلمة مرور جديدة (12 حرفًا أو أكثر)', 'New password (12+ chars)')} />
          <input className="input ltr" type="password" name="confirm_password" required minLength={12} autoComplete="new-password" placeholder={tr(locale, 'تأكيد كلمة المرور', 'Confirm password')} />
          <button className="btn btn-primary">{tr(locale, 'تغيير كلمة المرور', 'Change password')}</button>
        </form>
        <p className="small faint" style={{ marginTop: 8 }}>{tr(locale, 'يُسجَّل خروجك من كل الأجهزة الأخرى بعد التغيير.', 'All your other sessions are signed out after the change.')}</p>
      </Card>
      <Card title={tr(locale, 'مزودو الذكاء الاصطناعي', 'AI providers')} action={owner && <form action="/api/os/settings/integrations" method="post"><button className="btn btn-sm">{tr(locale, 'اختبار الاتصال', 'Test connections')}</button></form>}>
        <p className="small muted" style={{ marginBottom: 12 }}>{tr(locale, 'المفاتيح تُقرأ من متغيرات البيئة على الخادم فقط ولا تُخزن في قاعدة البيانات ولا تُرسل للمتصفح.', 'Keys are read from server environment variables only; never stored in the database or sent to the browser.')}</p>
        <div className="table-wrap"><table className="table"><tbody>
          {PROVIDERS.map((p) => {
            const i = d.integrations.find((x) => x.provider === p);
            return (
              <tr key={p}>
                <td className="mono">{p}</td>
                <td className="mono small faint">{KEY_ENV[p]}</td>
                <td><StatusBadge status={live.has(p) ? (i?.status === 'ok' || i?.status === 'error' ? i.status : 'configured') : 'missing'} locale={locale} /></td>
                <td className="small faint">{i?.last_checked_at ? formatDate(locale, i.last_checked_at, true) : ''}{i?.last_error ? ` · ${i.last_error}` : ''}</td>
              </tr>
            );
          })}
        </tbody></table></div>
        <p className="small faint" style={{ marginTop: 10 }}>{tr(locale, 'البريد الخارجي', 'Outbound email')}: {env().RESEND_API_KEY ? 'Resend ✓' : tr(locale, 'غير مُعد (الإرسال يدوي بعد الموافقة)', 'not configured (manual after approval)')}</p>
      </Card>

      <form action="/api/os/settings" method="post" className="stack">
        <fieldset disabled={!owner} className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
          <Card title={tr(locale, 'حدود الإنفاق والتنفيذ', 'Spend & execution limits')}>
            <div className="grid">
              <label className="field">{tr(locale, 'سقف الأمر الواحد (USD)', 'Per run (USD)')}<input className="input ltr" type="number" step="0.05" min="0.05" name="limits.workflow_usd" defaultValue={d.s['limits.workflow_usd']} /></label>
              <label className="field">{tr(locale, 'سقف الاجتماع (USD)', 'Per meeting (USD)')}<input className="input ltr" type="number" step="0.05" min="0.05" name="limits.meeting_usd" defaultValue={d.s['limits.meeting_usd']} /></label>
              <label className="field">{tr(locale, 'سقف خطة المونتاج (USD)', 'Per montage plan (USD)')}<input className="input ltr" type="number" step="0.05" min="0.05" name="limits.montage_usd" defaultValue={d.s['limits.montage_usd']} /></label>
              <label className="field">{tr(locale, 'الحد اليومي (USD)', 'Daily (USD)')}<input className="input ltr" type="number" step="0.5" min="0.5" name="limits.daily_usd" defaultValue={d.s['limits.daily_usd']} /></label>
              <label className="field">{tr(locale, 'الحد الشهري (USD)', 'Monthly (USD)')}<input className="input ltr" type="number" step="1" min="1" name="limits.monthly_usd" defaultValue={d.s['limits.monthly_usd']} /></label>
              <label className="field">{tr(locale, 'أقصى خطوات للخطة', 'Max plan steps')}<input className="input ltr" type="number" min="1" max="12" name="limits.max_steps" defaultValue={d.s['limits.max_steps']} /></label>
              <label className="field">{tr(locale, 'التنفيذ المتوازي', 'Parallel steps')}<input className="input ltr" type="number" min="1" max="6" name="limits.max_parallel" defaultValue={d.s['limits.max_parallel']} /></label>
            </div>
          </Card>
          <Card title={tr(locale, 'النماذج', 'Models')}>
            <label className="field" style={{ marginBottom: 12 }}>{tr(locale, 'ترتيب البدائل (Fallback)', 'Fallback order')}<input className="input ltr" name="fallback_order" defaultValue={d.s['ai.fallback_order'].join(', ')} /></label>
            <div className="table-wrap"><table className="table">
              <thead><tr><th>provider</th><th>{tr(locale, 'قياسي', 'Standard')}</th><th>{tr(locale, 'اقتصادي (مهام بسيطة)', 'Economy (simple work)')}</th></tr></thead>
              <tbody>{PROVIDERS.map((p) => (
                <tr key={p}><td className="mono">{p}</td>
                  <td><input className="input ltr" name={`model.${p}.standard`} defaultValue={d.s['ai.models'][p].standard} /></td>
                  <td><input className="input ltr" name={`model.${p}.economy`} defaultValue={d.s['ai.models'][p].economy} /></td></tr>
              ))}</tbody>
            </table></div>
            <label className="field" style={{ marginTop: 14 }}>
              {tr(locale, 'الأسعار المؤكدة (USD لكل مليون token): provider:model input output [cache_read] — سطر لكل نموذج. النماذج غير المسعّرة تُحسب بسعر تقديري مرتفع عمدًا.', 'Verified prices (USD per 1M tokens): provider:model input output [cache_read] — one per line. Unpriced models use a deliberately high estimate.')}
              <textarea className="textarea ltr mono" name="prices" defaultValue={prices} />
            </label>
            <p className="small faint">{tr(locale, 'السعر التقديري الحالي للنماذج غير المسعّرة', 'Current estimate for unpriced models')}: ${d.s['ai.unknown_price'].input} / ${d.s['ai.unknown_price'].output}</p>
          </Card>
          {owner && <div><button className="btn btn-primary">{tr(locale, 'حفظ الإعدادات', 'Save settings')}</button></div>}
        </fieldset>
      </form>

      <Card id="team" title={tr(locale, 'الفريق والصلاحيات', 'Team & permissions')}>
        <div className="table-wrap"><table className="table"><tbody>
          {d.members.map((m) => (
            <tr key={m.user_id}>
              <td>{m.name}<div className="small faint ltr">{m.email}</div></td>
              <td className="small faint">{formatDate(locale, m.last_login_at, true)}</td>
              <td>
                {owner && m.role !== 'owner' ? (
                  <form action={`/api/os/members/${m.user_id}`} method="post" className="row">
                    <select className="select" style={{ width: 130, minHeight: 32 }} name="role" defaultValue={m.role}>
                      {['admin', 'editor', 'viewer'].map((r) => <option key={r} value={r}>{label(locale, r)}</option>)}
                      <option value="remove">{tr(locale, 'إزالة', 'Remove')}</option>
                    </select>
                    <button className="btn btn-sm">✓</button>
                  </form>
                ) : <span className="badge plain">{label(locale, m.role)}</span>}
              </td>
            </tr>
          ))}
        </tbody></table></div>
        {owner && (
          <form action="/api/os/members" method="post" className="grid" style={{ marginTop: 14 }}>
            <input className="input" name="name" required placeholder={tr(locale, 'الاسم', 'Name')} />
            <input className="input ltr" type="email" name="email" required placeholder="email" />
            <input className="input ltr" type="password" name="password" required minLength={12} placeholder={tr(locale, 'كلمة مرور مؤقتة (12+)', 'Temporary password (12+)')} />
            <select className="select" name="role" defaultValue="editor">{['admin', 'editor', 'viewer'].map((r) => <option key={r} value={r}>{label(locale, r)}</option>)}</select>
            <button className="btn btn-sm">{tr(locale, 'إضافة عضو', 'Add member')}</button>
          </form>
        )}
      </Card>
    </div>
  );
}
