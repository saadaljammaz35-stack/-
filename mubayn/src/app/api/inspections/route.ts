import { requireUser } from "@/lib/auth";
import { json, readJson, route } from "@/lib/http";
import { createInspection, deviceSchema } from "@/lib/inspections";

export const POST = route("inspections.create", async (req) => {
  const s = await requireUser();
  const body = await readJson(req, deviceSchema);
  const id = await createInspection(s.user.id, body);
  return json({ id }, 201);
});
