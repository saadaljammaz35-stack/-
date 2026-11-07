import { requireUser } from "@/lib/auth";
import { json, route } from "@/lib/http";
import { deleteEvidence } from "@/lib/inspections";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = route<Ctx>("evidence.delete", async (_req, { params }) => {
  const s = await requireUser();
  const { id } = await params;
  await deleteEvidence(s.user.id, id);
  return json({ ok: true });
});
