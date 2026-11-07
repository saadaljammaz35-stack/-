import { z } from "zod";
import { passwordSchema, resetPassword } from "@/lib/accounts";
import { clearSessionCookie } from "@/lib/auth";
import { clientIp, json, readJson, route } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";

export const POST = route("auth.reset", async (req) => {
  await rateLimit(`reset-submit:ip:${clientIp(req) ?? "unknown"}`, 20, 3600);
  const { token, password } = await readJson(req, z.object({ token: z.string().min(20).max(100), password: passwordSchema }));
  await resetPassword(token, password, clientIp(req));
  await clearSessionCookie();
  return json({ ok: true });
});
