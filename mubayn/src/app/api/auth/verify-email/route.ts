import { z } from "zod";
import { verifyEmail } from "@/lib/accounts";
import { clientIp, json, readJson, route } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";

export const POST = route("auth.verify", async (req) => {
  await rateLimit(`verify:ip:${clientIp(req) ?? "unknown"}`, 30, 3600);
  const { token } = await readJson(req, z.object({ token: z.string().min(20).max(100) }));
  await verifyEmail(token);
  return json({ ok: true });
});
