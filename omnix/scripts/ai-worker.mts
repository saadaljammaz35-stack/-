// OMNIX background worker (Node): document ingestion and evaluation runs.
// Production runs this as its own process so no work depends on an HTTP
// request staying alive.
//
//   npm run ai-worker            loop forever
//   npm run ai-worker -- --once  process what is pending, then exit
//
// It connects with the same restricted DATABASE_URL as the app. Pending work
// is discovered through omnix_pending_work() (ids only); each item is then
// processed inside its owner's RLS context.
import { runEvaluation } from "@/lib/ai/eval/runner";
import { processDocument } from "@/lib/ai/rag/knowledge";
import { closePool, withAnon } from "@/lib/db/pool";
import { log } from "@/lib/log";

const once = process.argv.includes("--once");
let stopping = false;
process.on("SIGTERM", () => (stopping = true));
process.on("SIGINT", () => (stopping = true));

async function tick(): Promise<number> {
  await withAnon((db) => db.query("SELECT omnix_requeue_stale_work()"));
  const work = await withAnon((db) => db.query<{ kind: string; id: string; owner_id: string }>("SELECT * FROM omnix_pending_work(10)"));
  for (const w of work.rows) {
    if (stopping) break;
    const started = Date.now();
    try {
      if (w.kind === "document") await processDocument(w.owner_id, w.id);
      else await runEvaluation(w.owner_id, w.id);
      log.info("worker.done", { kind: w.kind, id: w.id, ms: Date.now() - started });
    } catch (err) {
      log.warn("worker.item_failed", { kind: w.kind, id: w.id, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return work.rowCount ?? 0;
}

try {
  log.info("worker.start", { once });
  // omnix_pending_work() skips items younger than 3 s (they may still be
  // processed inline by the request that created them); --once waits that out.
  if (once) await new Promise((r) => setTimeout(r, 3500));
  for (;;) {
    const n = await tick();
    if (once && n === 0) break;
    if (stopping) break;
    if (n === 0) await new Promise((r) => setTimeout(r, 5000));
  }
} finally {
  await closePool();
  log.info("worker.stop", {});
}
