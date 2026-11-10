import "server-only";
import { env } from "@/lib/config/env";
import { log } from "@/lib/log";

/**
 * Runs work after the response is sent when OMNIX_INLINE_JOBS is on
 * (development, single instance). In production the Node worker
 * (scripts/ai-worker.mts) picks up pending documents and queued evaluations
 * from the database, so nothing depends on a request staying alive.
 */
export async function runInBackground(name: string, fn: () => Promise<unknown>): Promise<void> {
  if (!env().OMNIX_INLINE_JOBS) return;
  const wrapped = async () => {
    try {
      await fn();
    } catch (err) {
      log.warn("background.failed", { job: name, error: err instanceof Error ? err.message : String(err) });
    }
  };
  try {
    const { after } = await import("next/server");
    after(wrapped);
  } catch {
    // Outside a Next.js request scope (scripts, tests).
    setImmediate(() => void wrapped());
  }
}
