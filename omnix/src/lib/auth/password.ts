import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";

function scrypt(password: string, salt: Buffer, keylen: number, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scryptCb(password, salt, keylen, opts, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

// scrypt with N=2^15, r=8, p=1 (OWASP baseline). Format:
//   scrypt$<log2N>$<r>$<p>$<salt b64url>$<hash b64url>
const LOG_N = 15;
const R = 8;
const P = 1;
const KEYLEN = 64;
const MAXMEM = 128 * 2 ** LOG_N * R * 2;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password.normalize("NFKC"), salt, KEYLEN, { N: 2 ** LOG_N, r: R, p: P, maxmem: MAXMEM });
  return `scrypt$${LOG_N}$${R}$${P}$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, logN, r, p, saltB64, hashB64] = parts;
  const n = 2 ** Number(logN);
  const expected = Buffer.from(hashB64!, "base64url");
  const actual = await scrypt(password.normalize("NFKC"), Buffer.from(saltB64!, "base64url"), expected.length, {
    N: n,
    r: Number(r),
    p: Number(p),
    maxmem: 128 * n * Number(r) * 2,
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// Used when the email does not exist so the response time does not reveal it.
let dummy: Promise<string> | null = null;
export function dummyHash(): Promise<string> {
  dummy ??= hashPassword(randomBytes(16).toString("hex"));
  return dummy;
}

export function passwordProblems(password: string): string[] {
  const problems: string[] = [];
  if (password.length < 10) problems.push("at least 10 characters");
  if (password.length > 200) problems.push("at most 200 characters");
  if (!/[A-Za-z؀-ۿ]/.test(password)) problems.push("at least one letter");
  if (!/\d/.test(password)) problems.push("at least one digit");
  return problems;
}
