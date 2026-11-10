import { withAnon } from "@/lib/db/pool";
import { json, route } from "@/lib/http/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Liveness + database readiness. Reveals no configuration. */
export const GET = route.public({}, async () => {
  try {
    await withAnon((db) => db.query("SELECT 1"));
    return { status: "ok", database: "ok" };
  } catch {
    return json({ status: "degraded", database: "unreachable" }, { status: 503 });
  }
});
