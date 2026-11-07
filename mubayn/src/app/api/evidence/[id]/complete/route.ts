import { requireUser } from "@/lib/auth";
import { json, route } from "@/lib/http";
import { completeUpload } from "@/lib/inspections";

export const maxDuration = 60;
type Ctx = { params: Promise<{ id: string }> };

/** Step 2 of an upload: the server verifies what actually landed in storage. */
export const POST = route<Ctx>("evidence.complete", async (_req, { params }) => {
  const s = await requireUser();
  const { id } = await params;
  const ev = await completeUpload(s.user.id, id);
  return json({ id: ev.id, status: ev.status, kind: ev.kind, width: ev.width, height: ev.height, durationMs: ev.duration_ms });
});
