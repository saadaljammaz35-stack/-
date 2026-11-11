import { registerSchema } from "@/lib/api/schemas";
import { createSession, registerUser, sessionCookie } from "@/lib/auth/session";
import { env } from "@/lib/config/env";
import { AppError } from "@/lib/http/errors";
import { json, route } from "@/lib/http/route";

export const runtime = "nodejs";

export const POST = route.public(
  { body: registerSchema, rateLimit: { name: "register", limit: 5, windowSec: 3600, by: "ip" } },
  async ({ body, req, ip }) => {
    // A private deployment closes sign-up once its owner has an account.
    if (!env().OMNIX_REGISTRATION_OPEN) throw new AppError("FORBIDDEN", "Registration is closed on this server");
    const { userId, workspaceId } = await registerUser(body);
    const token = await createSession(userId, { userAgent: req.headers.get("user-agent"), ip });
    return json({ userId, workspaceId }, { status: 201, headers: { "set-cookie": sessionCookie(token, env().OMNIX_SESSION_TTL_HOURS * 3600) } });
  },
);
