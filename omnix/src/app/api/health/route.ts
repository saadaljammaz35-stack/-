import { withAnon } from "@/lib/db/pool";
import { json, route } from "@/lib/http/route";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Liveness + database readiness. Reveals no configuration. */
export const GET = route.public({}, async () => {
  try {
    await withAnon((db) => db.query("SELECT 1"));
    return { status: "ok", database: "ok" };
  } catch (err) {
    // The reason goes to the server log (redacted), never to the public response.
    log.error("health.failed", { error: err instanceof Error ? err : String(err) });
    return json({ status: "degraded", database: "unreachable" }, { status: 503 });
  }
});
