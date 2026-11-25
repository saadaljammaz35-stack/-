import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { json, withOrg } from '@/lib/db';
import { POST as login } from '@/app/api/os/auth/login/route';
import { POST as montageCreate } from '@/app/api/os/episodes/[id]/montage/route';
import { GET as montageStatus, POST as montageAction } from '@/app/api/os/montage/[id]/route';
import { GET as media } from '@/app/api/os/media/[id]/route';
import { POST as callback } from '@/app/api/montage/callback/[id]/route';
import { addMember, FOUNDER, q1, setupDb, teardown, type TestEnv } from './helpers';

const ORIGIN = 'http://ward.test';
const params = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) });
function req(p: string, opts: { method?: string; body?: unknown; cookie?: string } = {}) {
  const headers: Record<string, string> = { host: 'ward.test', origin: ORIGIN };
  if (opts.cookie) headers.cookie = opts.cookie;
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  return new Request(`${ORIGIN}${p}`, { method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'), headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined });
}
async function signIn(email: string, password: string) {
  const res = await login(req('/api/os/auth/login', { body: { email, password } }), params({}));
  return res.headers.get('set-cookie')!.split(';')[0]!;
}

describe('montage API', () => {
  let env: TestEnv;
  let owner: string;
  let viewer: string;
  let editor: string;
  let episodeId: string;
  let projectId: string;
  let assetId: string;

  beforeAll(async () => {
    env = await setupDb();
    process.env.WARD_MEDIA_STORAGE = 'local';
    await addMember(env, 'viewer-m@ward.test', 'viewer');
    await addMember(env, 'editor-m@ward.test', 'editor');
    owner = await signIn(FOUNDER.email, FOUNDER.password);
    viewer = await signIn('viewer-m@ward.test', 'member password 123');
    editor = await signIn('editor-m@ward.test', 'member password 123');
    episodeId = (await q1<{ id: string }>(env.founder, 'select id from ward.episodes limit 1')).id;
    // A project waiting for its runner, with a known callback token hash.
    ({ projectId, assetId } = await withOrg(env.founder, async (q) => {
      const a = await q.query<{ id: string }>(`insert into ward.media_assets (org_id, episode_id, kind, storage, storage_key, name, mime, size) values ($1,$2,'source','local',$3,'x.mp4','video/mp4',10) returning id`, [env.orgId, episodeId, `ward/${env.orgId}/${episodeId}/00000000-0000-0000-0000-000000000001/x.mp4`]);
      const { createHash } = await import('node:crypto');
      const p = await q.query<{ id: string }>(
        `insert into ward.montage_projects (org_id, episode_id, source_asset_id, status, runner) values ($1,$2,$3,'analyzing',$4::jsonb) returning id`,
        [env.orgId, episodeId, a[0]!.id, json({ runId: 'run-1', mode: 'sandbox', task: 'analyze', startedAt: new Date().toISOString(), callbackHash: createHash('sha256').update('secret-token').digest('hex') })],
      );
      return { projectId: p[0]!.id, assetId: a[0]!.id };
    }));
  });
  afterAll(async () => {
    delete process.env.WARD_MEDIA_STORAGE;
    await teardown(env);
  });

  it('only editors and above can upload or start a montage', async () => {
    const body = { action: 'intent', name: 'ep.mp4', size: 100, type: 'video/mp4' };
    expect((await montageCreate(req(`/api/os/episodes/${episodeId}/montage`, { body, cookie: viewer }), params({ id: episodeId }))).status).toBe(403);
    const ok = await montageCreate(req(`/api/os/episodes/${episodeId}/montage`, { body, cookie: editor }), params({ id: episodeId }));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ storage: 'local', uploadUrl: expect.stringContaining('/api/os/montage/upload?key=') });
    expect((await montageAction(req(`/api/os/montage/${projectId}`, { body: { action: 'render' }, cookie: viewer }), params({ id: projectId }))).status).toBe(403);
  });

  it('deleting a montage is limited to the founder and admins', async () => {
    const res = await montageAction(req(`/api/os/montage/${projectId}`, { body: { action: 'delete' }, cookie: editor }), params({ id: projectId }));
    expect(res.status).toBe(403);
  });

  it('the runner callback needs the per-run token, and only the current run is accepted', async () => {
    const bad = await callback(new Request(`${ORIGIN}/api/montage/callback/${projectId}?t=wrong`, { method: 'POST', body: '{}' }), params({ id: projectId }));
    expect(bad.status).toBe(404);
    const stale = await callback(
      new Request(`${ORIGIN}/api/montage/callback/${projectId}?t=secret-token`, { method: 'POST', body: JSON.stringify({ ok: false, error: 'boom', runId: 'old-run' }) }),
      params({ id: projectId }),
    );
    expect(await stale.json()).toEqual({ ok: true, accepted: false });
    const failed = await callback(
      new Request(`${ORIGIN}/api/montage/callback/${projectId}?t=secret-token`, { method: 'POST', body: JSON.stringify({ ok: false, error: 'could not read the media file', runId: 'run-1' }) }),
      params({ id: projectId }),
    );
    expect(await failed.json()).toEqual({ ok: true, accepted: true });
    const p = await q1<{ status: string; error: string; runner: unknown }>(env.founder, 'select status, error, runner from ward.montage_projects where id = $1', [projectId]);
    expect(p).toMatchObject({ status: 'failed', runner: null });
    expect(p.error).toContain('could not read the media file');
    const status = await montageStatus(req(`/api/os/montage/${projectId}`, { cookie: viewer }), params({ id: projectId }));
    expect(await status.json()).toMatchObject({ status: 'failed' });
  });

  it('media is never served across organizations', async () => {
    const { seed } = await import('@/lib/seed');
    await seed({ orgSlug: 'rival-api', founder: { email: 'rival-api@org.test', password: 'rival long password', name: 'R' } });
    const rival = await signIn('rival-api@org.test', 'rival long password');
    expect((await media(req(`/api/os/media/${assetId}`, { cookie: rival }), params({ id: assetId }))).status).toBe(404);
    expect((await montageStatus(req(`/api/os/montage/${projectId}`, { cookie: rival }), params({ id: projectId }))).status).toBe(404);
    expect((await media(req(`/api/os/media/${assetId}`, { cookie: owner }), params({ id: assetId }))).status).not.toBe(404);
  });
});
