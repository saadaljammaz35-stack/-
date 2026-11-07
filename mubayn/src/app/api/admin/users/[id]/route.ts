import { z } from "zod";
import { audit } from "@/lib/audit";
import { issueRecoveryCode } from "@/lib/accounts";
import { requireAdmin, revokeAllSessions } from "@/lib/auth";
import { one, query } from "@/lib/db";
import { badRequest, notFound } from "@/lib/errors";
import { clientIp, json, readJson, route } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>("admin.users", async (req, { params }) => {
  const admin = await requireAdmin();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) throw notFound();
  const { action } = await readJson(req, z.object({ action: z.enum(["disable", "enable", "revoke_sessions", "recovery_code"]) }));
  const u = await one<{ id: string; role: string }>(`SELECT id, role FROM users WHERE id = $1 AND status <> 'deleted'`, [id]);
  if (!u) throw notFound();
  if (u.id === admin.user.id) throw badRequest("self", "You cannot change your own account here");
  if (action === "recovery_code") {
    if (u.role === "admin") throw badRequest("target_admin", "Recovery codes for admin accounts cannot be issued here");
    const recoveryCode = await issueRecoveryCode(id);
    await audit(admin.user.id, "admin.user_recovery_code", { type: "user", id }, {}, clientIp(req));
    return json({ ok: true, recoveryCode });
  }
  if (action === "disable") {
    await query(`UPDATE users SET status = 'disabled', updated_at = now() WHERE id = $1`, [id]);
    await revokeAllSessions(id);
  } else if (action === "enable") {
    await query(`UPDATE users SET status = 'active', failed_logins = 0, locked_until = NULL, updated_at = now() WHERE id = $1`, [id]);
  } else {
    await revokeAllSessions(id);
  }
  await audit(admin.user.id, `admin.user_${action}`, { type: "user", id }, {}, clientIp(req));
  return json({ ok: true });
});
