import { withUser } from "@/lib/db/pool";
import { route } from "@/lib/http/route";

export const runtime = "nodejs";

export const GET = route.auth({ sessionOnly: true }, async ({ auth }) =>
  withUser(auth.userId, async (db) => {
    const r = await db.query(
      `SELECT id, action, resource_type, resource_id, request_id, metadata, created_at FROM ai_audit_events
        WHERE actor_id = $1 ORDER BY created_at DESC LIMIT 200`,
      [auth.userId],
    );
    return { events: r.rows };
  }),
);
