import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";
import { notFound } from "@/lib/errors";
import { json, route } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>("admin.errors", async (_req, { params }) => {
  const admin = await requireAdmin();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) throw notFound();
  await query(`UPDATE error_events SET resolved_at = now(), resolved_by = $2 WHERE id = $1`, [id, admin.user.id]);
  return json({ ok: true });
});
