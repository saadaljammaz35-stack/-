import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { withOrg } from '@/lib/db';
import { seed } from '@/lib/seed';
import { storeFile } from '@/lib/services/admin';
import { POST as login } from '@/app/api/os/auth/login/route';
import { POST as createTask } from '@/app/api/os/tasks/route';
import { POST as updateEpisode } from '@/app/api/os/episodes/[id]/route';
import { POST as decide } from '@/app/api/os/approvals/[id]/route';
import { POST as killSwitch } from '@/app/api/os/kill-switch/route';
import { POST as addMember } from '@/app/api/os/members/route';
import { GET as getFile } from '@/app/api/os/files/[id]/route';
import { GET as cron } from '@/app/api/cron/route';
import { POST as saveGuest } from '@/app/api/os/guests/[id]/route';
import { addMember as addTestMember, FOUNDER, q1, setupDb, teardown, type TestEnv } from './helpers';

const ORIGIN = 'http://ward.test';

function req(path: string, opts: { method?: string; body?: unknown; cookie?: string; origin?: string | null; form?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { host: 'ward.test' };
  if (opts.origin !== null) headers.origin = opts.origin ?? ORIGIN;
  if (opts.cookie) headers.cookie = opts.cookie;
  let body: string | undefined;
  if (opts.form) {
    headers['content-type'] = 'application/x-www-form-urlencoded';
    body = new URLSearchParams(opts.form).toString();
  } else if (opts.body !== undefined) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  return new Request(`${ORIGIN}${path}`, { method: opts.method ?? (body ? 'POST' : 'GET'), headers, body });
}

const params = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) });

async function signIn(email: string, password: string): Promise<string> {
  const res = await login(req('/api/os/auth/login', { body: { email, password } }), params({}));
  expect(res.status).toBe(200);
  const cookie = res.headers.get('set-cookie')!;
  expect(cookie).toMatch(/HttpOnly/);
  expect(cookie).toMatch(/SameSite=Strict/);
  return cookie.split(';')[0]!;
}

describe('API security', () => {
  let env: TestEnv;
  let owner: string;
  let editor: string;
  let viewer: string;
  let episodeId: string;

  beforeAll(async () => {
    env = await setupDb();
    await addTestMember(env, 'editor@ward.test', 'editor');
    await addTestMember(env, 'viewer@ward.test', 'viewer');
    owner = await signIn(FOUNDER.email, FOUNDER.password);
    editor = await signIn('editor@ward.test', 'member password 123');
    viewer = await signIn('viewer@ward.test', 'member password 123');
    episodeId = (await q1<{ id: string }>(env.founder, 'select id from ward.episodes limit 1')).id;
  });
  afterAll(() => teardown(env));

  it('rejects requests without a session', async () => {
    const res = await createTask(req('/api/os/tasks', { body: { title: 'x' } }), params({}));
    expect(res.status).toBe(401);
  });

  it('rejects wrong passwords without revealing whether the account exists, and rate-limits', async () => {
    const wrong = await login(req('/api/os/auth/login', { body: { email: FOUNDER.email, password: 'nope-nope-nope' } }), params({}));
    const ghost = await login(req('/api/os/auth/login', { body: { email: 'ghost@ward.test', password: 'nope-nope-nope' } }), params({}));
    expect(wrong.status).toBe(401);
    expect(ghost.status).toBe(401);
    expect(await wrong.json()).toEqual(await ghost.json());
    let last = 0;
    for (let i = 0; i < 6; i++) last = (await login(req('/api/os/auth/login', { body: { email: 'target@ward.test', password: `guess-${i}-xxxxxx` } }), params({}))).status;
    expect(last).toBe(429);
  });

  it('blocks cross-site and origin-less writes (CSRF)', async () => {
    const noOrigin = await createTask(req('/api/os/tasks', { body: { title: 'x' }, cookie: owner, origin: null }), params({}));
    expect(noOrigin.status).toBe(403);
    const evil = await createTask(req('/api/os/tasks', { body: { title: 'x' }, cookie: owner, origin: 'https://evil.example' }), params({}));
    expect(evil.status).toBe(403);
    expect((await evil.json()).error).toBe('cross_origin');
  });

  it('enforces the role matrix on the server', async () => {
    expect((await createTask(req('/api/os/tasks', { body: { title: 'مهمة' }, cookie: viewer }), params({}))).status).toBe(403);
    const ok = await createTask(req('/api/os/tasks', { body: { title: 'تجهيز المايكات', priority: 'high' }, cookie: editor }), params({}));
    expect(ok.status).toBe(200);
    expect((await killSwitch(req('/api/os/kill-switch', { body: { paused: true }, cookie: editor }), params({}))).status).toBe(403);
    expect((await addMember(req('/api/os/members', { body: { email: 'x@ward.test', name: 'x', role: 'admin', password: 'xxxxxxxxxxxxxxx' }, cookie: editor }), params({}))).status).toBe(403);
  });

  it('validates input', async () => {
    const res = await createTask(req('/api/os/tasks', { body: { title: '', priority: 'whenever' }, cookie: owner }), params({}));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('validation_failed');
  });

  it('only the founder confirms a guest', async () => {
    const guestId = (await q1<{ guest_id: string }>(env.founder, 'select guest_id from ward.episodes where id = $1', [episodeId])).guest_id;
    const byEditor = await updateEpisode(req(`/api/os/episodes/${episodeId}`, { body: { guest_confirmed: true }, cookie: editor }), params({ id: episodeId }));
    expect(byEditor.status).toBe(403);
    expect((await saveGuest(req(`/api/os/guests/${guestId}`, { body: { status: 'confirmed' }, cookie: editor }), params({ id: guestId }))).status).toBe(403);
    expect((await q1<{ guest_confirmed: boolean }>(env.founder, 'select guest_confirmed from ward.episodes where id = $1', [episodeId])).guest_confirmed).toBe(false);
  });

  it('nothing is published without founder approval', async () => {
    const byEditor = await updateEpisode(req(`/api/os/episodes/${episodeId}`, { body: { status: 'published' }, cookie: editor }), params({ id: episodeId }));
    expect(byEditor.status).toBe(403);
    const unapproved = await updateEpisode(req(`/api/os/episodes/${episodeId}`, { body: { status: 'published' }, cookie: owner }), params({ id: episodeId }));
    expect(unapproved.status).toBe(400);
    expect((await unapproved.json()).error).toBe('publish_requires_founder_approval');
    const approved = await updateEpisode(
      req(`/api/os/episodes/${episodeId}`, { body: { approval_status: 'approved', status: 'published', publish_links: 'youtube | https://youtube.com/watch?v=abc' }, cookie: owner }),
      params({ id: episodeId }),
    );
    expect(approved.status).toBe(200);
    const ep = await q1<{ status: string; publish_links: unknown[] }>(env.founder, 'select status, publish_links from ward.episodes where id = $1', [episodeId]);
    expect(ep.status).toBe('published');
    expect(ep.publish_links).toEqual([{ platform: 'youtube', url: 'https://youtube.com/watch?v=abc' }]);
  });

  it('approval decisions are founder-only at the route level too', async () => {
    const id = await withOrg(env.founder, async (q) =>
      (await q.query<{ id: string }>(`insert into ward.approvals (org_id, action_type, title, target) values ($1,'send_external_message','دعوة الضيف','guest@example.com') returning id`, [env.orgId]))[0]!.id,
    );
    expect((await decide(req(`/api/os/approvals/${id}`, { body: { decision: 'approve' }, cookie: editor }), params({ id }))).status).toBe(403);
    const res = await decide(req(`/api/os/approvals/${id}`, { body: { decision: 'approve' }, cookie: owner }), params({ id }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: 'approved', result: { mode: 'manual' } }); // no email integration → not "sent"
  });

  it('HTML form posts redirect back instead of returning JSON', async () => {
    const res = await createTask(req('/api/os/tasks', { form: { title: 'من نموذج' }, cookie: owner }), params({}));
    expect(res.status).toBe(303);
  });

  it('private files never cross organizations', async () => {
    const fileId = await storeFile(env.founder, { name: 'contract.txt', mime: 'text/plain', data: new TextEncoder().encode('سري'), purpose: 'agreement' });
    const mine = await getFile(req(`/api/os/files/${fileId}`, { cookie: owner }), params({ id: fileId }));
    expect(mine.status).toBe(200);
    expect(mine.headers.get('cache-control')).toContain('private');

    await seed({ orgSlug: 'rival', founder: { email: 'rival@org.test', password: 'rival long password', name: 'Rival' } });
    const rival = await signIn('rival@org.test', 'rival long password');
    expect((await getFile(req(`/api/os/files/${fileId}`, { cookie: rival }), params({ id: fileId }))).status).toBe(404);
  });

  it('the cron endpoint requires its secret', async () => {
    delete process.env.CRON_SECRET;
    expect((await cron(req('/api/cron'))).status).toBe(401);
    process.env.CRON_SECRET = 'a-very-long-cron-secret-value-123';
    expect((await cron(new Request(`${ORIGIN}/api/cron`, { headers: { authorization: 'Bearer wrong-secret-value-of-same-size' } }))).status).toBe(401);
    const ok = await cron(new Request(`${ORIGIN}/api/cron`, { headers: { authorization: 'Bearer a-very-long-cron-secret-value-123' } }));
    expect(ok.status).toBe(200);
    delete process.env.CRON_SECRET;
  });
});
