import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { one, query } from "@/lib/db";
import { notFound } from "@/lib/errors";
import { clientIp, json, readJson, route } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("review"), note: z.string().trim().max(2000).optional() }),
  z.object({ action: z.literal("withdraw"), note: z.string().trim().min(3).max(2000) }),
]);

export const POST = route<Ctx>("admin.reports", async (req, { params }) => {
  const admin = await requireAdmin();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) throw notFound();
  const body = await readJson(req, schema);
  const r = await one<{ id: string }>(`SELECT id FROM reports WHERE id = $1`, [id]);
  if (!r) throw notFound();
  if (body.action === "review") {
    await query(`UPDATE reports SET reviewed_by = $2, reviewed_at = now(), review_note = $3 WHERE id = $1`, [id, admin.user.id, body.note ?? null]);
  } else {
    // Withdrawn reports disappear from the customer's view; the record stays for audit.
    await query(`UPDATE reports SET status = 'withdrawn', reviewed_by = $2, reviewed_at = now(), review_note = $3 WHERE id = $1`, [id, admin.user.id, body.note]);
  }
  await audit(admin.user.id, `admin.report_${body.action}`, { type: "report", id }, { note: body.note ?? null }, clientIp(req));
  return json({ ok: true });
});
