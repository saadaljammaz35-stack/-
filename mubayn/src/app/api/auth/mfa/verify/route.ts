import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { decrypt } from "@/lib/crypto";
import { one, query } from "@/lib/db";
import { badRequest, forbidden } from "@/lib/errors";
import { clientIp, json, readJson, route } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { verifyTotp } from "@/lib/totp";

export const POST = route("auth.mfa.verify", async (req) => {
  const s = await requireUser();
  if (s.user.role !== "admin") throw forbidden();
  await rateLimit(`mfa:${s.user.id}`, 10, 900);
  const { code } = await readJson(req, z.object({ code: z.string().regex(/^\d{6}$/) }));
  const u = await one<{ mfa_secret_enc: string | null; mfa_enabled_at: Date | null }>(`SELECT mfa_secret_enc, mfa_enabled_at FROM users WHERE id = $1`, [s.user.id]);
  if (!u?.mfa_secret_enc) throw badRequest("mfa_not_started", "Start two-factor setup first");
  if (!verifyTotp(decrypt(u.mfa_secret_enc), code)) {
    await audit(s.user.id, "auth.mfa_failed", { type: "user", id: s.user.id }, {}, clientIp(req));
    throw badRequest("invalid_code", "That code is not valid");
  }
  if (!u.mfa_enabled_at) {
    await query(`UPDATE users SET mfa_enabled_at = now() WHERE id = $1`, [s.user.id]);
    await audit(s.user.id, "auth.mfa_enrolled", { type: "user", id: s.user.id }, {}, clientIp(req));
  }
  await query(`UPDATE sessions SET mfa_verified = true, last_seen_at = now() WHERE id = $1`, [s.id]);
  return json({ ok: true });
});
