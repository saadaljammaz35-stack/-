import { z } from "zod";
import { emailSchema, passwordSchema, register } from "@/lib/accounts";
import { createSession, setSessionCookie } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { clientIp, json, readJson, route } from "@/lib/http";
import { getLimits } from "@/lib/settings";

const schema = z.object({
  email: emailSchema,
  password: passwordSchema,
  fullName: z.string().trim().min(1).max(100),
  locale: z.enum(["ar", "en"]).default("ar"),
  acceptTerms: z.literal(true),
});

export const POST = route("auth.register", async (req) => {
  const body = await readJson(req, schema);
  if (!(await getLimits()).signupsOpen) throw new AppError(503, "signups_closed", "New sign-ups are paused");
  const ip = clientIp(req);
  const r = await register(body, ip);
  if (r.created && r.recoveryCode) {
    // No e-mail on this deployment: the account is ready, so sign in now and
    // show the recovery code once.
    await setSessionCookie(await createSession(r.userId, { ip, userAgent: req.headers.get("user-agent") }));
    return json({ ok: true, signedIn: true, recoveryCode: r.recoveryCode });
  }
  // With e-mail: identical response whether or not the address already had an account.
  return json({ ok: true });
});
