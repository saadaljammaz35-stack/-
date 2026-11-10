import { loginSchema } from "@/lib/api/schemas";
import { authenticate, createSession, sessionCookie } from "@/lib/auth/session";
import { env } from "@/lib/config/env";
import { json, route } from "@/lib/http/route";

export const runtime = "nodejs";

export const POST = route.public(
  { body: loginSchema, rateLimit: { name: "login", limit: 10, windowSec: 300, by: "ip" } },
  async ({ body, req, ip }) => {
    const userId = await authenticate(body.email, body.password);
    const token = await createSession(userId, { userAgent: req.headers.get("user-agent"), ip });
    return json({ userId }, { headers: { "set-cookie": sessionCookie(token, env().OMNIX_SESSION_TTL_HOURS * 3600) } });
  },
);
