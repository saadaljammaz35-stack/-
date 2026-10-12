// Meta signs every webhook POST with the app secret: X-Hub-Signature-256 is
// "sha256=" + hex HMAC-SHA256 of the raw request body. The HMAC must be taken
// over the exact bytes received; re-serialised JSON would not match.

import { hmacSha256Hex, timingSafeEqual } from "../crypto.ts";

const SIGNATURE_HEADER = /^sha256=([0-9a-fA-F]{64})$/;

/** True only for a well-formed header whose HMAC matches the body. Never throws for bad input. */
export async function verifyMetaSignature(
  rawBody: Uint8Array<ArrayBuffer>,
  header: string | null,
  appSecret: string,
): Promise<boolean> {
  if (!header || appSecret === "") return false;
  const received = SIGNATURE_HEADER.exec(header.trim())?.[1];
  if (!received) return false;
  const expected = await hmacSha256Hex(appSecret, rawBody);
  return timingSafeEqual(expected, received.toLowerCase());
}
