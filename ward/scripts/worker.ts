import './_env';
import { getDb } from '@/lib/db';
import { migrate } from '@/lib/db/migrate';
import { drainQueue } from '@/lib/queue/worker';

/**
 * Long-running worker for self-hosted deployments (Docker, VM, Render, Fly…).
 * On Vercel use the cron endpoint instead (see DEPLOYMENT.md).
 */
const db = await getDb();
await migrate(db);
let stopping = false;
for (const sig of ['SIGINT', 'SIGTERM'] as const) process.on(sig, () => (stopping = true));
console.info('[ward-worker] started');
while (!stopping) {
  try {
    const r = await drainQueue({ maxMs: 60_000, concurrency: 3 });
    if (r.processed || r.failed || r.scheduled) console.info(`[ward-worker] processed=${r.processed} failed=${r.failed} scheduled=${r.scheduled}`);
  } catch (err) {
    console.error('[ward-worker] drain error', err);
  }
  await new Promise((r) => setTimeout(r, 5_000));
}
await db.close();
console.info('[ward-worker] stopped');
