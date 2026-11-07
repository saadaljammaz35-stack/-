import QRCode from "qrcode";
import { requireUser } from "@/lib/auth";
import { encrypt } from "@/lib/crypto";
import { query } from "@/lib/db";
import { conflict, forbidden } from "@/lib/errors";
import { json, route } from "@/lib/http";
import { generateTotpSecret, otpauthUri } from "@/lib/totp";

/** Starts TOTP enrolment for an admin who has not enrolled yet. */
export const POST = route("auth.mfa.setup", async () => {
  const s = await requireUser();
  if (s.user.role !== "admin") throw forbidden();
  if (s.user.mfa_enabled_at) throw conflict("already_enrolled", "Two-factor authentication is already set up");
  const secret = generateTotpSecret();
  await query(`UPDATE users SET mfa_secret_enc = $2, updated_at = now() WHERE id = $1 AND mfa_enabled_at IS NULL`, [s.user.id, encrypt(secret)]);
  const uri = otpauthUri(secret, s.user.email);
  const svg = await QRCode.toString(uri, { type: "svg", margin: 1, width: 220 });
  return json({ secret, uri, svg });
});
