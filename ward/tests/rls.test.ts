import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { withOrg } from '@/lib/db';
import { seed } from '@/lib/seed';
import { setupDb, teardown, type TestEnv } from './helpers';

describe('organization isolation (row-level security)', () => {
  let env: TestEnv;
  let otherOrg: string;

  beforeAll(async () => {
    env = await setupDb();
    otherOrg = (await seed({ orgSlug: 'other-org', founder: { email: 'other@org.test', password: 'another long password', name: 'Other' } })).orgId;
  });
  afterAll(() => teardown(env));

  it('a request scoped to one organization cannot read another organization’s rows', async () => {
    const mine = await withOrg(env.founder, (q) => q.query<{ org_id: string }>('select org_id from ward.sponsors'));
    expect(mine.length).toBe(11);
    expect(new Set(mine.map((r) => r.org_id))).toEqual(new Set([env.orgId]));

    const theirs = await withOrg({ orgId: otherOrg, userId: null, role: 'system' }, (q) => q.query('select id from ward.sponsors'));
    expect(theirs.length).toBe(11);

    // Even an explicit filter on the other org returns nothing.
    const leak = await withOrg(env.founder, (q) => q.query('select id from ward.episodes where org_id = $1', [otherOrg]));
    expect(leak).toEqual([]);
  });

  it('rejects writes that target another organization', async () => {
    await expect(
      withOrg(env.founder, (q) => q.query(`insert into ward.tasks (org_id, title) values ($1, 'cross-tenant')`, [otherOrg])),
    ).rejects.toThrow(/row-level security/);
  });

  it('sessions, rate limits and password hashes are unreachable from the request role', async () => {
    await expect(withOrg(env.founder, (q) => q.query('select * from ward.sessions'))).rejects.toThrow(/permission denied/);
    await expect(withOrg(env.founder, (q) => q.query('select * from ward.rate_limits'))).rejects.toThrow(/permission denied/);
    await expect(withOrg(env.founder, (q) => q.query(`update ward.users set password_hash = 'x'`))).rejects.toThrow(/permission denied/);
  });

  it('the audit trail is append-only for the application', async () => {
    await withOrg(env.founder, (q) => q.query(`insert into ward.audit_logs (org_id, actor_type, action) values ($1, 'user', 'test')`, [env.orgId]));
    await expect(withOrg(env.founder, (q) => q.query('delete from ward.audit_logs'))).rejects.toThrow(/permission denied/);
    await expect(withOrg(env.founder, (q) => q.query(`update ward.audit_logs set action = 'tampered'`))).rejects.toThrow(/permission denied/);
  });

  it('a published episode must have founder approval (database constraint)', async () => {
    await expect(
      withOrg(env.founder, (q) => q.query(`update ward.episodes set status = 'published' where title = 'أكبر من عمره'`)),
    ).rejects.toThrow(/episode_published_needs_approval/);
  });
});

describe('seed data is honest', () => {
  let env: TestEnv;
  beforeAll(async () => {
    env = await setupDb();
  });
  afterAll(() => teardown(env));

  it('seeds nine agents, each with a least-privilege tool list', async () => {
    const agents = await withOrg(env.founder, (q) =>
      q.query<{ slug: string; allowed_tools: string[] }>('select a.slug, c.allowed_tools from ward.ai_agents a join ward.agent_configs c on c.agent_id = a.id'),
    );
    expect(agents.map((a) => a.slug).sort()).toEqual(['business', 'chief', 'editorial', 'finance', 'marketing', 'production', 'relations', 'review', 'tech']);
    const review = agents.find((a) => a.slug === 'review')!;
    expect(review.allowed_tools.some((t) => t.startsWith('request_'))).toBe(false);
  });

  it('first episode is a draft with an unconfirmed proposed guest', async () => {
    const ep = (await withOrg(env.founder, (q) =>
      q.query<{ title: string; topic: string; status: string; guest_confirmed: boolean; approval_status: string; guest: string; guest_status: string }>(
        `select e.title, e.topic, e.status, e.guest_confirmed, e.approval_status, g.name as guest, g.status as guest_status
           from ward.episodes e join ward.guests g on g.id = e.guest_id`,
      ),
    ))[0]!;
    expect(ep).toMatchObject({ title: 'أكبر من عمره', topic: 'المشاريع وصناعة المحتوى بعمر صغير', status: 'idea', guest_confirmed: false, approval_status: 'draft', guest: 'صاحب قناة باب مشوي', guest_status: 'proposed' });
  });

  it('sponsors are pending verification with no invented values, dates or contracts', async () => {
    const sponsors = await withOrg(env.founder, (q) =>
      q.query<{ name: string; status: string; value_amount: unknown; agreement_start: unknown; category: unknown; name_pending: boolean }>(
        'select name, status, value_amount, agreement_start, category, name_pending from ward.sponsors order by created_at',
      ),
    );
    expect(sponsors.map((s) => s.name)).toEqual(['سهم', 'سماط', 'OMNIX', 'مداد', 'محلّك', 'مُبيّن', 'دوري', 'CliniBot', 'RAVENX', 'مع الله', 'علامة إضافية — بانتظار تحديد الاسم']);
    for (const s of sponsors) {
      expect(s.status).toBe('pending_verification');
      expect(s.value_amount).toBeNull();
      expect(s.agreement_start).toBeNull();
      expect(s.category).toBeNull();
    }
    expect(sponsors.filter((s) => s.name_pending)).toHaveLength(1);
    const agreements = await withOrg(env.founder, (q) => q.query('select 1 from ward.sponsorship_agreements'));
    expect(agreements).toHaveLength(0);
  });

  it('every automation is off by default', async () => {
    const autos = await withOrg(env.founder, (q) => q.query<{ enabled: boolean }>('select enabled from ward.automations'));
    expect(autos).toHaveLength(8);
    expect(autos.every((a) => !a.enabled)).toBe(true);
  });

  it('seeding twice changes nothing', async () => {
    const again = await seed({ founder: null });
    expect(again.created).toEqual([]);
  });
});
