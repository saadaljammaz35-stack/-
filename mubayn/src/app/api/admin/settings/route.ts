import { requireAdmin } from "@/lib/auth";
import { json, readJson, route } from "@/lib/http";
import { limitsSchema, updateLimits } from "@/lib/settings";

export const PUT = route("admin.settings", async (req) => {
  const admin = await requireAdmin();
  const limits = await readJson(req, limitsSchema);
  await updateLimits(admin.user.id, limits);
  return json({ ok: true });
});
