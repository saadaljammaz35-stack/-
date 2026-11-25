import Link from 'next/link';
import { requirePage } from '@/lib/auth/page';
import { withOrg } from '@/lib/db';
import { getPrefs } from '@/lib/prefs';
import { dict, tr, usd } from '@/lib/i18n';
import { AGENT_BY_SLUG, type AgentSlug } from '@/lib/agents/definitions';
import { SENSITIVE_TOOLS } from '@/lib/agents/tools';
import { AgentMono, PageHeader, StatusBadge } from '@/components/os/ui';

export default async function AgentsPage() {
  const session = await requirePage();
  const { locale } = await getPrefs();
  const t = dict(locale);
  const agents = await withOrg(session, (q) =>
    q.query<{ slug: AgentSlug; name: string; title_ar: string; title_en: string; description: string; status: string; provider: string | null; model: string | null; tools: string[]; runs: number; month_cost: number; memories: number }>(
      `select a.slug, a.name, a.title_ar, a.title_en, a.description, a.status, c.provider, c.model, c.allowed_tools as tools,
              (select count(*)::int from ward.agent_runs r where r.agent_id = a.id) as runs,
              (select coalesce(sum(r.cost_usd),0)::float8 from ward.agent_runs r where r.agent_id = a.id and r.started_at >= date_trunc('month', now())) as month_cost,
              (select count(*)::int from ward.agent_memories m where m.agent_id = a.id) as memories
         from ward.ai_agents a join ward.agent_configs c on c.agent_id = a.id order by a.created_at`,
    ),
  );
  return (
    <div className="stack">
      <PageHeader title={t.nav.agents} subtitle={tr(locale, 'تسعة وكلاء، لكل منهم تعليمات وصلاحيات وأدوات وذاكرة وسجل مستقل. أي إجراء حساس يتحول إلى طلب موافقة.', 'Nine agents, each with its own instructions, permissions, tools, memory and log. Every sensitive action becomes an approval request.')} />
      <div className="grid">
        {agents.map((a) => (
          <Link key={a.slug} href={`/os/agents/${a.slug}`} className="card fade-in stack" style={{ gap: 12 }}>
            <div className="spread">
              <span className="row"><AgentMono name={a.name} /><span style={{ display: 'grid' }}><strong style={{ fontWeight: 600 }}>{a.name}</strong><span className="small muted">{locale === 'ar' ? a.title_ar : a.title_en}</span></span></span>
              <StatusBadge status={a.status} locale={locale} />
            </div>
            <p className="small muted">{a.description}</p>
            <div className="row small faint">
              <span>{a.tools.length} {tr(locale, 'أداة', 'tools')} ({a.tools.filter((x) => SENSITIVE_TOOLS.includes(x)).length} {tr(locale, 'بموافقة', 'need approval')})</span>·
              <span>{a.runs} {tr(locale, 'تشغيل', 'runs')}</span>·<span>{usd(a.month_cost)}</span>·<span>{a.memories} {tr(locale, 'ذاكرة', 'memories')}</span>
            </div>
            <div className="small faint ltr">{a.provider ? `${a.provider} · ${a.model ?? 'default'}` : tr(locale, 'المزود: حسب ترتيب الإعدادات', 'Provider: settings order')}</div>
            <span className="small faint">{AGENT_BY_SLUG[a.slug].duties[0]}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
