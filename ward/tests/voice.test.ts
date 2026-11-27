import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { withOrg } from '@/lib/db';
import { runAgentStructured } from '@/lib/agents/runner';
import { updateSettings } from '@/lib/services/admin';
import { getSettings } from '@/lib/settings';
import { install, ScriptedProvider, setupDb, teardown, type TestEnv } from './helpers';

describe('agents voice (founder: Najdi dialect, short answers)', () => {
  let env: TestEnv;
  beforeAll(async () => {
    env = await setupDb();
  });
  afterAll(() => teardown(env));

  it('is part of every agent prompt and editable by the founder', async () => {
    const provider = install(new ScriptedProvider('anthropic', () => ({ text: JSON.stringify({ ok: true }) })));
    await runAgentStructured({ ctx: env.founder, agent: 'chief', purpose: 'test', task: 'وش الوضع؟', name: 'x', schema: z.object({ ok: z.boolean() }) });
    expect(provider.calls[0]!.system).toContain('اللهجة النجدية');
    expect(provider.calls[0]!.system).toContain('اختصر');

    await updateSettings(env.founder, { 'agents.voice': 'تكلم باللهجة الحجازية.' });
    expect((await withOrg(env.founder, (q) => getSettings(q, env.orgId)))['agents.voice']).toBe('تكلم باللهجة الحجازية.');
    await runAgentStructured({ ctx: env.founder, agent: 'production', purpose: 'test', task: 'وش الوضع؟', name: 'x', schema: z.object({ ok: z.boolean() }) });
    expect(provider.calls[1]!.system).toContain('الحجازية');
    expect(provider.calls[1]!.system).not.toContain('النجدية');
  });
});
