import type { Metadata } from 'next';
import { requirePage } from '@/lib/auth/page';
import { withOrg } from '@/lib/db';
import { getPrefs } from '@/lib/prefs';
import { getSettings } from '@/lib/settings';
import { dict, label } from '@/lib/i18n';
import { can } from '@/lib/auth/permissions';
import { Icon } from '@/components/Icon';
import { CollapseButton, KillSwitch, LangButton, MenuButton, NavLinks, Scrim, ThemeButton, type NavItem } from '@/components/os/client';
import { scheduleQueue } from '@/lib/api';
import s from '../os.module.css';

export const metadata: Metadata = { title: 'WARD OS', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';
// Background work scheduled with after() runs within this budget (serverless hosts).
export const maxDuration = 300;

export default async function OsLayout({ children }: { children: React.ReactNode }) {
  const session = await requirePage();
  // Serverless hosts have no always-on worker: each WARD OS page view nudges the durable queue.
  scheduleQueue();
  const { locale, sidebarCollapsed } = await getPrefs();
  const t = dict(locale);
  const counts = await withOrg(session, async (q) => {
    const row = (await q.query<{ approvals: number; unread: number; active: number }>(
      `select (select count(*)::int from ward.approvals where status = 'pending') as approvals,
              (select count(*)::int from ward.notifications where read_at is null) as unread,
              (select count(*)::int from ward.workflows where status in ('queued','planning','running','reviewing')) as active`,
    ))[0]!;
    const settings = await getSettings(q, session.orgId);
    return { ...row, paused: settings.agents_paused };
  });

  const items: NavItem[] = [
    { href: '/os', label: t.nav.dashboard, icon: 'dashboard' },
    { href: '/os/runs', label: t.nav.runs, icon: 'runs', count: counts.active },
    { href: '/os/agents', label: t.nav.agents, icon: 'agents' },
    { href: '/os/meetings', label: t.nav.meetings, icon: 'meetings' },
    { href: '/os/episodes', label: t.nav.episodes, icon: 'episodes' },
    { href: '/os/tasks', label: t.nav.tasks, icon: 'tasks' },
    { href: '/os/sponsors', label: t.nav.sponsors, icon: 'sponsors' },
    { href: '/os/approvals', label: t.nav.approvals, icon: 'approvals', count: counts.approvals },
    { href: '/os/finance', label: t.nav.finance, icon: 'finance' },
    { href: '/os/knowledge', label: t.nav.knowledge, icon: 'knowledge' },
    { href: '/os/automations', label: t.nav.automations, icon: 'automations' },
    { href: '/os/settings', label: t.nav.settings, icon: 'settings' },
    ...(can(session.role, 'audit.read') ? [{ href: '/os/audit', label: t.nav.audit, icon: 'audit' }] : []),
  ];

  return (
    <div id="ward-shell" className={s.shell} data-collapsed={sidebarCollapsed} data-open="false">
      <aside className={s.sidebar}>
        <div className={s.brand}>
          <span className={s.brandWord}>{locale === 'ar' ? 'وارد' : 'WARD'}</span>
          <span className={s.brandTag}>OS</span>
        </div>
        <NavLinks items={items} />
        <div className={s.sideFoot}>
          <div className={s.user}>
            <span className={s.avatar}>{session.name.slice(0, 1)}</span>
            <span className={s.userMeta}>
              <span>{session.name}</span>
              <span className="faint small">{label(locale, session.role)}</span>
            </span>
          </div>
          <form action="/api/os/auth/logout" method="post">
            <button className={s.navItem} style={{ width: '100%', border: 0, background: 'transparent', font: 'inherit', cursor: 'pointer' }}>
              <Icon name="logout" className={s.navIcon} />
              <span className={s.label}>{t.common.signOut}</span>
            </button>
          </form>
        </div>
      </aside>
      <Scrim />
      <div className={s.main}>
        <header className={s.topbar}>
          <MenuButton label="menu" />
          <CollapseButton label={t.common.collapse} />
          <span className={s.topTitle}>{t.os}</span>
          <span className={s.spacer} />
          {can(session.role, 'kill_switch') && <KillSwitch paused={counts.paused} stopLabel={t.kill.stop} resumeLabel={t.kill.resume} confirmText={t.kill.confirm} />}
          <a href="/os/notifications" className={s.iconBtn} aria-label="notifications">
            <Icon name="bell" />
            {counts.unread > 0 && <span className={s.dot} />}
          </a>
          <LangButton label={t.common.language} next={locale === 'ar' ? 'en' : 'ar'} />
          <ThemeButton label={t.common.theme} />
        </header>
        <main className={s.content}>{children}</main>
      </div>
    </div>
  );
}
