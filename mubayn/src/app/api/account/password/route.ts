import { z } from "zod";
import { changePassword, passwordSchema } from "@/lib/accounts";
import { requireUser } from "@/lib/auth";
import { json, readJson, route } from "@/lib/http";

export const POST = route("account.password", async (req) => {
  const s = await requireUser();
  const { current, next } = await readJson(req, z.object({ current: z.string().min(1).max(200), next: passwordSchema }));
  await changePassword(s.user.id, s.id, current, next);
  return json({ ok: true });
});
