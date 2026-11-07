import { requireUser } from "@/lib/auth";
import { json, readJson, route } from "@/lib/http";
import { requestUpload, uploadRequestSchema } from "@/lib/inspections";

type Ctx = { params: Promise<{ id: string }> };

/** Step 1 of an upload: get a short-lived URL to PUT the file straight to private storage. */
export const POST = route<Ctx>("evidence.request", async (req, { params }) => {
  const s = await requireUser();
  const { id } = await params;
  const out = await requestUpload(s.user.id, id, await readJson(req, uploadRequestSchema));
  return json(out, 201);
});
