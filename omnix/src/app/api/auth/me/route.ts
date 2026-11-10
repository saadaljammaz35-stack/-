import { meUpdateSchema } from "@/lib/api/schemas";
import { withUser } from "@/lib/db/pool";
import { route } from "@/lib/http/route";

export const runtime = "nodejs";

export const GET = route.auth({}, async ({ auth }) =>
  withUser(auth.userId, async (db) => {
    const u = await db.query("SELECT id, email, display_name, locale, theme, is_platform_admin, created_at FROM users WHERE id = $1", [auth.userId]);
    const ws = await db.query(
      `SELECT w.id, w.name, m.role FROM workspaces w JOIN workspace_members m ON m.workspace_id = w.id
        WHERE m.user_id = $1 ORDER BY w.created_at`,
      [auth.userId],
    );
    const r = u.rows[0];
    return {
      user: { id: r.id, email: r.email, displayName: r.display_name, locale: r.locale, theme: r.theme, isPlatformAdmin: r.is_platform_admin },
      workspaceId: auth.workspaceId,
      workspaces: ws.rows,
      via: auth.via,
    };
  }),
);

export const PATCH = route.auth({ sessionOnly: true, body: meUpdateSchema }, async ({ auth, body }) =>
  withUser(auth.userId, async (db) => {
    await db.query(
      `UPDATE users SET display_name = COALESCE($2, display_name), locale = COALESCE($3, locale), theme = COALESCE($4, theme) WHERE id = $1`,
      [auth.userId, body.displayName ?? null, body.locale ?? null, body.theme ?? null],
    );
    return { ok: true };
  }),
);
