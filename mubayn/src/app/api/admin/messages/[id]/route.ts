import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";
import { notFound } from "@/lib/errors";
import { json, route } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>("admin.messages", async (_req, { params }) => {
  await requireAdmin();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) throw notFound();
  await query(`UPDATE contact_messages SET status = 'closed' WHERE id = $1`, [id]);
  return json({ ok: true });
});
