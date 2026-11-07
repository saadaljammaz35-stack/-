import { z } from "zod";
import { emailSchema, login } from "@/lib/accounts";
import { setSessionCookie } from "@/lib/auth";
import { clientIp, json, readJson, route } from "@/lib/http";

const schema = z.object({ email: emailSchema, password: z.string().min(1).max(200) });

export const POST = route("auth.login", async (req) => {
  const { email, password } = await readJson(req, schema);
  const r = await login(email, password, { ip: clientIp(req), userAgent: req.headers.get("user-agent") });
  await setSessionCookie(r.token);
  return json({ ok: true, role: r.role });
});
