import { z } from "zod";
import { emailSchema, passwordSchema, recoverWithCode } from "@/lib/accounts";
import { clientIp, json, readJson, route } from "@/lib/http";

const schema = z.object({ email: emailSchema, code: z.string().trim().min(16).max(40), password: passwordSchema });

export const POST = route("auth.recover", async (req) => {
  const { email, code, password } = await readJson(req, schema);
  const recoveryCode = await recoverWithCode(email, code, password, clientIp(req));
  return json({ ok: true, recoveryCode });
});
