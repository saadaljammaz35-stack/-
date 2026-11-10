import { clearSessionCookie, revokeSession } from "@/lib/auth/session";
import { json, route } from "@/lib/http/route";

export const runtime = "nodejs";

export const POST = route.auth({ sessionOnly: true }, async ({ auth }) => {
  if (auth.sessionId) await revokeSession(auth.userId, auth.sessionId);
  return json({ ok: true }, { headers: { "set-cookie": clearSessionCookie() } });
});
