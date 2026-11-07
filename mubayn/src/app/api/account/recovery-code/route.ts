import { z } from "zod";
import { regenerateRecoveryCode } from "@/lib/accounts";
import { requireUser } from "@/lib/auth";
import { json, readJson, route } from "@/lib/http";

export const POST = route("account.recovery_code", async (req) => {
  const s = await requireUser();
  const { password } = await readJson(req, z.object({ password: z.string().min(1).max(200) }));
  return json({ ok: true, recoveryCode: await regenerateRecoveryCode(s.user.id, password) });
});
