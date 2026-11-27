import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { JSON_PARAM_TYPE, json, system, withOrg } from '@/lib/db';
import { claimJobs, enqueue } from '@/lib/queue';
import { setupDb, teardown, type TestEnv } from './helpers';

/**
 * Regression: postgres.js JSON.stringify()s values bound to json/jsonb parameters, so the JSON
 * text produced by `json()` was stored as a JSON *string* in production (job payloads lost their
 * ids and no command or meeting ever ran). PGlite never showed it; run this file with
 * TEST_DATABASE_URL to exercise the real driver.
 */
describe('JSON parameters', () => {
  it('JSON text passes through, values are encoded once', () => {
    expect(JSON_PARAM_TYPE.serialize(json({ a: 1 }))).toBe('{"a":1}');
    expect(JSON_PARAM_TYPE.serialize({ a: 1 })).toBe('{"a":1}');
    expect(JSON_PARAM_TYPE.serialize([1, 'x'])).toBe('[1,"x"]');
  });
});

describe.skipIf(!process.env.TEST_DATABASE_URL)('JSON round trip on real Postgres', () => {
  let env: TestEnv;
  beforeAll(async () => {
    env = await setupDb();
  });
  afterAll(() => teardown(env));

  it('stores job payloads as objects and reads the ids back', async () => {
    await withOrg(env.founder, (q) => enqueue(q, env.orgId, 'workflow.advance', { workflowId: 'wf-1' }));
    const kinds = await system((q) => q.query<{ t: string }>(`select jsonb_typeof(payload) as t from ward.jobs`));
    expect(kinds.map((k) => k.t)).toEqual(['object']);
    const [job] = await claimJobs('test', 1);
    expect(job!.payload.workflowId).toBe('wf-1');
    expect(job!.org_id).toBe(env.orgId);
  });

  it('seeded and written JSON columns are objects, not strings', async () => {
    const bad = await system((q) =>
      q.query<{ n: number }>(`select count(*)::int as n from ward.system_settings where jsonb_typeof(value) = 'string' and (value #>> '{}') ~ '^[\\[{"0-9tfn-]'`),
    );
    expect(bad[0]!.n).toBe(0);
  });
});
