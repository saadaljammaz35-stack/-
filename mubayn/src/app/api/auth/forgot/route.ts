import { z } from "zod";
import { emailSchema, requestPasswordReset } from "@/lib/accounts";
import { clientIp, json, readJson, route } from "@/lib/http";

export const POST = route("auth.forgot", async (req) => {
  const { email } = await readJson(req, z.object({ email: emailSchema }));
  await requestPasswordReset(email, clientIp(req));
  return json({ ok: true });
});
