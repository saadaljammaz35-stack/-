// demo-request: the marketing site's "book a demo" form (anonymous; see
// docs/API.md). The request is reported as received only once the row is
// stored. The caller's IP is kept only as a salted hash, for rate limiting.

import { type Db, dbFailure, serviceClient } from "../_shared/db.ts";
import { z } from "../_shared/deps.ts";
import { type Handler, json, parse, readJson } from "../_shared/http.ts";
import { log } from "../_shared/log.ts";
import { normalizePhone } from "../_shared/phone.ts";
import { clientIpHash, rateLimit } from "../_shared/ratelimit.ts";

export interface Deps {
  db: Db;
  now: () => Date;
}

export function liveDeps(): Deps {
  return { db: serviceClient(), now: () => new Date() };
}

export const CLINIC_TYPES = ["dental", "dermatology", "general", "cosmetic", "physio", "other"] as const;

/** Optional free text: absent, null or blank all mean "not given". */
const optionalText = (max: number) => z.string().trim().max(max).nullish().transform((value) => (value ? value : null));

const Body = z.object({
  clinic_name: z.string().trim().min(2).max(120),
  contact_name: z.string().trim().min(2).max(120),
  phone: z.string().max(40).transform((value, ctx) => {
    const phone = normalizePhone(value);
    if (phone === null) {
      ctx.addIssue({ code: "custom", message: "Enter a valid mobile number, e.g. 05XXXXXXXX" });
      return z.NEVER;
    }
    return phone;
  }),
  email: z
    .string()
    .trim()
    .max(254)
    .pipe(z.union([z.literal(""), z.email()]))
    .nullish()
    .transform((value) => (value ? value : null)),
  city: optionalText(80),
  clinic_type: z.union([z.enum(CLINIC_TYPES), z.literal("")]).nullish().transform((value) => (value ? value : null)),
  message: optionalText(2000),
  locale: z.enum(["ar", "en"]),
  consent: z.literal(true, { error: "Consent is required" }),
  // Honeypot: hidden from people, so only a bot fills it in.
  website: z.literal("", { error: "Must be empty" }).optional(),
});

export function createHandler(getDeps: () => Deps): Handler {
  return async (req: Request): Promise<Response> => {
    const { db, now } = getDeps();
    const input = parse(Body, await readJson(req, 16 * 1024));
    const ipHash = await clientIpHash(req);
    await rateLimit(db, `demo:${ipHash}`, 5, 3600);

    const { data, error } = await db
      .from("demo_requests")
      .insert({
        clinic_name: input.clinic_name,
        contact_name: input.contact_name,
        phone: input.phone,
        email: input.email,
        city: input.city,
        clinic_type: input.clinic_type,
        message: input.message,
        locale: input.locale,
        consent_at: now().toISOString(),
        ip_hash: ipHash,
      })
      .select("id")
      .single();
    if (error) dbFailure("demo_request_insert", error);
    const id = (data as { id?: unknown } | null)?.id;
    if (typeof id !== "string") dbFailure("demo_request_insert", { message: "insert returned no row" });

    log.info("demo_request.created", { id });
    return json(req, { ok: true, id }, 201);
  };
}
