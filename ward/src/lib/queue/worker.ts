import { randomUUID } from 'node:crypto';
import { env } from '@/lib/env';
import { system } from '@/lib/db';
import { claimJobs, enqueue, failJob, finishJob, type Job, type JobKind } from '@/lib/queue';
import { advanceWorkflow } from '@/lib/orchestrator';
import { runMeeting } from '@/lib/meetings';
import { runAutomation, schedulerTick } from '@/lib/automations';

const STEP_DEADLINE_MS = Number(process.env.WARD_JOB_DEADLINE_MS ?? 240_000);

const HANDLERS: Record<JobKind, (job: Job) => Promise<void>> = {
  async 'workflow.advance'(job) {
    const workflowId = String(job.payload.workflowId);
    const settled = await advanceWorkflow(job.org_id, workflowId, { deadlineMs: STEP_DEADLINE_MS });
    if (!settled) {
      // Not finished within this slice (deadline, or another worker holds the lease): continue later.
      await system((q) => enqueue(q, job.org_id, 'workflow.advance', { workflowId }, { runAt: new Date(Date.now() + 5_000) }));
    }
  },
  async 'meeting.run'(job) {
    await runMeeting(job.org_id, String(job.payload.meetingId));
  },
  async 'automation.run'(job) {
    await runAutomation(job.org_id, String(job.payload.automationId));
  },
  async 'knowledge.index'() {
    /* indexing is synchronous today; kind reserved for large imports */
  },
};

export interface DrainResult {
  processed: number;
  failed: number;
  scheduled: number;
}

/**
 * Process due jobs until none are left or the time budget is spent. Used by the
 * long-running worker (`npm run worker`), by the cron endpoint and inline after requests.
 */
export async function drainQueue(opts: { maxMs?: number; concurrency?: number; workerId?: string; tick?: boolean } = {}): Promise<DrainResult> {
  const deadline = Date.now() + (opts.maxMs ?? 50_000);
  const workerId = opts.workerId ?? `w-${process.pid}-${randomUUID().slice(0, 8)}`;
  const result: DrainResult = { processed: 0, failed: 0, scheduled: 0 };
  if (opts.tick !== false) result.scheduled = await schedulerTick();
  while (Date.now() < deadline) {
    const jobs = await claimJobs(workerId, opts.concurrency ?? 3);
    if (jobs.length === 0) break;
    await Promise.all(
      jobs.map(async (job) => {
        try {
          await HANDLERS[job.kind](job);
          await finishJob(job.id);
          result.processed++;
        } catch (err) {
          result.failed++;
          await failJob(job, err instanceof Error ? err.message : String(err));
        }
      }),
    );
  }
  return result;
}

const state = globalThis as unknown as { __wardDrain?: Promise<DrainResult> | null };

/** Fire-and-forget inline processing (dev server, single-node deployments). */
export function kickQueue(): Promise<DrainResult> | null {
  if (env().WARD_INLINE_JOBS !== 'true') return null;
  if (state.__wardDrain) return state.__wardDrain;
  state.__wardDrain = drainQueue({ maxMs: 280_000 })
    .catch((err) => {
      console.error('[ward] inline queue drain failed', err);
      return { processed: 0, failed: 1, scheduled: 0 };
    })
    .finally(() => {
      state.__wardDrain = null;
    });
  return state.__wardDrain;
}
