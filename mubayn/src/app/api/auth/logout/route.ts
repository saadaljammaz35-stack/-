import { clearSessionCookie, currentSession, revokeSession } from "@/lib/auth";
import { json, route } from "@/lib/http";

export const POST = route("auth.logout", async () => {
  const s = await currentSession();
  if (s) await revokeSession(s.id);
  await clearSessionCookie();
  return json({ ok: true });
});
