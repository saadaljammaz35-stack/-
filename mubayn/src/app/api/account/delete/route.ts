import { z } from "zod";
import { deleteAccount } from "@/lib/accounts";
import { clearSessionCookie, requireUser } from "@/lib/auth";
import { clientIp, json, readJson, route } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";

export const maxDuration = 60;

export const POST = route("account.delete", async (req) => {
  const s = await requireUser();
  await rateLimit(`delete:${s.user.id}`, 5, 3600);
  const { password } = await readJson(req, z.object({ password: z.string().min(1).max(200) }));
  await deleteAccount(s.user.id, password, clientIp(req));
  await clearSessionCookie();
  return json({ ok: true });
});
