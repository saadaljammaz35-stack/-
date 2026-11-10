import { createHash, randomBytes } from "node:crypto";

export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function sha256(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

/** API keys look like omx_<8 public chars>_<43 secret chars>. Only a hash is stored. */
export function newApiKey(): { token: string; prefix: string } {
  const pub = randomBytes(5).toString("hex").slice(0, 8);
  const secret = randomBytes(32).toString("base64url");
  const prefix = `omx_${pub}`;
  return { token: `${prefix}_${secret}`, prefix };
}

export function isApiKeyShape(token: string): boolean {
  return /^omx_[a-z0-9]{8}_[A-Za-z0-9_-]{43}$/.test(token);
}
