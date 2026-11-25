import { withOrg, type OrgContext } from '@/lib/db';
import { audit } from '@/lib/audit';
import { can } from '@/lib/auth/permissions';
import { forbidden } from '@/lib/http';
import { notify } from '@/lib/notifications';
import { setSetting } from '@/lib/settings';

/**
 * Stop every agent now. The flag is checked before every model call (budget guard) and
 * at every orchestration step, so in-flight work stops at its next call; queued runs and
 * meetings are cancelled immediately. Resuming does not restart anything automatically.
 */
export async function setAgentsPaused(ctx: OrgContext, paused: boolean): Promise<{ cancelledRuns: number; cancelledMeetings: number }> {
  if (!can(ctx.role, 'kill_switch')) throw forbidden('missing_permission:kill_switch');
  return withOrg(ctx, async (q) => {
    await setSetting(q, ctx.orgId, 'agents_paused', paused, ctx.userId);
    let cancelledRuns = 0;
    let cancelledMeetings = 0;
    if (paused) {
      const runs = await q.query<{ id: string }>(
        `update ward.workflows set status = 'cancelled', error = 'kill_switch', finished_at = now()
          where status in ('queued','planning','running','reviewing') returning id`,
      );
      cancelledRuns = runs.length;
      for (const r of runs) {
        await q.query(`update ward.workflow_steps set status = 'cancelled' where workflow_id = $1 and status in ('pending','running')`, [r.id]);
        await q.query(`insert into ward.workflow_events (org_id, workflow_id, kind, message) values ($1,$2,'status','cancelled: kill_switch')`, [ctx.orgId, r.id]);
      }
      cancelledMeetings = (await q.query(`update ward.meetings set status = 'cancelled', finished_at = now() where status in ('queued','running') returning id`)).length;
      await q.query(`update ward.jobs set status = 'cancelled', finished_at = now() where status = 'queued' and kind in ('workflow.advance','meeting.run','automation.run')`);
      await q.query(`update ward.ai_agents set status = 'idle' where status = 'working'`);
      await notify(q, ctx.orgId, { kind: 'kill_switch', severity: 'critical', title: 'تم إيقاف جميع الوكلاء', body: `أُلغي ${cancelledRuns} أمر تشغيل و${cancelledMeetings} اجتماع.`, link: '/os/settings' });
    }
    await audit(q, ctx, paused ? 'agents.paused' : 'agents.resumed', { type: 'system' }, { cancelledRuns, cancelledMeetings });
    return { cancelledRuns, cancelledMeetings };
  });
}
