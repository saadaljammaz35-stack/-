import { z } from "zod";
import { emailSchema, passwordSchema, register } from "@/lib/accounts";
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
  await register(body, clientIp(req));
  // Identical response whether or not the address already had an account.
  return json({ ok: true });
});
