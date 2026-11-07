// End-to-end test of a deployment WITHOUT e-mail (EMAIL_DRIVER=none), against
// a running server started with that setting and the AI test double.
//
// What it proves: an account works straight after sign-up (no verification
// step) and gets a one-time recovery code; nothing is e-mailed; the report is
// delivered on the site; the recovery code resets the password, signs out
// every device and is replaced; a signed-in customer can replace the code;
// an admin can issue a code for a customer but not for another admin.
//
//   BASE=http://localhost:3100 DATABASE_URL=... MOCK=http://localhost:3999 node e2e/no-email.mts
import { createHmac } from "node:crypto";
import { execFileSync } from "node:child_process";
import pg from "pg";
import sharp from "sharp";

const BASE = process.env.BASE ?? "http://localhost:3100";
const MOCK = process.env.MOCK ?? "http://localhost:3999";
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

let passed = 0;
const failures: string[] = [];
async function step(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failures.push(`${name}: ${(e as Error).message}`);
    console.log(`  ✗ ${name}\n      ${(e as Error).message}`);
  }
}
function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

class Client {
  cookie = "";
  async call(method: string, url: string, body?: unknown) {
    const headers: Record<string, string> = { origin: BASE };
    if (this.cookie) headers.cookie = this.cookie;
    if (body !== undefined) headers["content-type"] = "application/json";
    const res = await fetch(BASE + url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined, redirect: "manual" });
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [kv] = c.split(";");
      if (kv!.startsWith("mubayn_session=")) this.cookie = kv!.endsWith("=") ? "" : kv!;
    }
    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch { /* not json */ }
    return { status: res.status, json, text };
  }
}

async function photo(i: number): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="1000"><rect width="100%" height="100%" fill="hsl(${i * 53},35%,62%)"/>
    <rect x="${450 + i * 9}" y="120" width="520" height="780" rx="60" fill="#1b2430"/><text x="60" y="100" font-size="56">no-email ${i}</text></svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 88 }).toBuffer();
}
async function upload(c: Client, inspectionId: string, file: Buffer, name: string) {
  const r = await c.call("POST", `/api/inspections/${inspectionId}/evidence`, { filename: name, contentType: "image/jpeg", bytes: file.length });
  assert(r.status === 201, `evidence ${r.status} ${r.text}`);
  const put = await fetch(r.json.uploadUrl, { method: "PUT", headers: r.json.headers, body: new Uint8Array(file) });
  assert(put.ok, `PUT ${put.status}`);
  const done = await c.call("POST", `/api/evidence/${r.json.evidenceId}/complete`);
  assert(done.status === 200 && done.json.status === "ready", `complete ${done.text}`);
}
const totp = (secret: string) => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0, value = 0; const out: number[] = [];
  for (const ch of secret) { value = (value << 5) | alphabet.indexOf(ch); bits += 5; if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; } }
  const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const h = createHmac("sha1", Buffer.from(out)).update(msg).digest();
  const o = h[h.length - 1]! & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, "0");
};
const CODE = /^[A-Z2-7]{5}(-[A-Z2-7]{5}){3}$/;

await db.query("DELETE FROM rate_limits");
await fetch(`${MOCK}/__mode`, { method: "POST", body: JSON.stringify({ mode: "ok" }) });
const stamp = Date.now();
const email = `ne-${stamp}@example.test`;
const pw1 = "First-Long-Passw0rd!";
const pw2 = "Second-Long-Passw0rd!";
const pw3 = "Third-Long-Passw0rd!";
const C = new Client();
let code1 = "";
let userId = "";

console.log("\n[1] Sign-up without e-mail");
await step("health reports e-mail off", async () => {
  const h = await (await fetch(`${BASE}/api/health`)).json();
  assert(h.email === "none", `email=${h.email}; start the server with EMAIL_DRIVER=none`);
});
await step("sign-up signs in at once and returns a one-time recovery code", async () => {
  const r = await C.call("POST", "/api/auth/register", { fullName: "No Email", email, password: pw1, locale: "ar", acceptTerms: true });
  assert(r.status === 200 && r.json.signedIn === true && CODE.test(r.json.recoveryCode ?? ""), `register ${r.status} ${r.text}`);
  assert(C.cookie, "no session cookie");
  code1 = r.json.recoveryCode;
  const u = await db.query(`SELECT id, email_verified_at, recovery_code_hash FROM users WHERE email = $1`, [email]);
  userId = u.rows[0].id;
  assert(u.rows[0].email_verified_at === null, "address must stay unverified");
  assert(u.rows[0].recovery_code_hash && !u.rows[0].recovery_code_hash.toString().includes(code1.replace(/-/g, "")), "code stored in clear");
});
await step("the same e-mail cannot sign up twice", async () => {
  const r = await new Client().call("POST", "/api/auth/register", { fullName: "x", email, password: pw1, locale: "en", acceptTerms: true });
  assert(r.status === 409 && r.json.error.code === "email_taken", `${r.status} ${r.text}`);
});
await step("e-mail password reset is refused (no e-mail on this site)", async () => {
  const r = await new Client().call("POST", "/api/auth/forgot", { email });
  assert(r.status === 400 && r.json.error.code === "email_disabled", `${r.status} ${r.text}`);
});
await step("forgot-password page shows the recovery-code form", async () => {
  const r = await new Client().call("GET", "/forgot-password");
  assert(r.status === 200 && (r.text.includes("رمز الاستعادة") || r.text.includes("Recovery code")), `status ${r.status}`);
});

console.log("\n[2] Inspection and report on the site, nothing e-mailed");
let inspection = "";
await step("unverified account submits and the report is published", async () => {
  const c = await C.call("POST", "/api/inspections", { deviceCategory: "phone", brand: "Samsung", model: "Galaxy S23", purchaseContext: "buying", reportLanguage: "ar" });
  assert(c.status === 201, `create ${c.status} ${c.text}`);
  inspection = c.json.id;
  for (let i = 1; i <= 4; i++) await upload(C, inspection, await photo(i), `p${i}.jpg`);
  const s = await C.call("POST", `/api/inspections/${inspection}/submit`);
  assert(s.status === 200, `submit ${s.status} ${s.text}`);
  const until = Date.now() + 90_000;
  for (;;) {
    const g = await C.call("GET", `/api/inspections/${inspection}`);
    if (g.json?.status === "completed" && g.json.reportId) {
      const page = await C.call("GET", `/reports/${g.json.reportId}`);
      assert(page.status === 200, `report page ${page.status}`);
      break;
    }
    assert(g.json?.status !== "failed", "analysis failed");
    assert(Date.now() < until, `timed out, status=${g.json?.status}`);
    await new Promise((r) => setTimeout(r, 1500));
  }
});
await step("no e-mail was sent or logged for this account", async () => {
  const n = await db.query(`SELECT count(*)::int AS n FROM email_log WHERE to_address = $1 OR user_id = $2`, [email, userId]);
  assert(n.rows[0].n === 0, `${n.rows[0].n} e-mail rows`);
});

console.log("\n[3] Password recovery with the code");
const other = new Client();
await step("a wrong code is refused and audited", async () => {
  const r = await other.call("POST", "/api/auth/recover", { email, code: "AAAAA-BBBBB-CCCCC-DDDDD", password: pw2 });
  assert(r.status === 400 && r.json.error.code === "invalid_recovery", `${r.status} ${r.text}`);
  const a = await db.query(`SELECT count(*)::int AS n FROM audit_log WHERE action = 'auth.recovery_failed' AND target_id = $1`, [userId]);
  assert(a.rows[0].n >= 1, "not audited");
});
await step("an unknown e-mail gets the same answer", async () => {
  const r = await other.call("POST", "/api/auth/recover", { email: `nobody-${stamp}@example.test`, code: code1, password: pw2 });
  assert(r.status === 400 && r.json.error.code === "invalid_recovery", `${r.status} ${r.text}`);
});
let code2 = "";
await step("the right code (typed in lower case, no dashes) sets a new password and returns a new code", async () => {
  const r = await other.call("POST", "/api/auth/recover", { email, code: code1.toLowerCase().replace(/-/g, " "), password: pw2 });
  assert(r.status === 200 && CODE.test(r.json.recoveryCode ?? "") && r.json.recoveryCode !== code1, `${r.status} ${r.text}`);
  code2 = r.json.recoveryCode;
});
await step("every earlier session is signed out", async () => {
  const r = await C.call("GET", `/api/inspections/${inspection}`);
  assert(r.status === 401, `old session still works: ${r.status}`);
});
await step("old password fails, new password works", async () => {
  assert((await new Client().call("POST", "/api/auth/login", { email, password: pw1 })).status === 401, "old password accepted");
  assert((await C.call("POST", "/api/auth/login", { email, password: pw2 })).status === 200, "new password refused");
});
await step("the used code no longer works", async () => {
  const r = await other.call("POST", "/api/auth/recover", { email, code: code1, password: pw3 });
  assert(r.status === 400, `${r.status} ${r.text}`);
});
await step("a signed-in customer replaces the code (password required)", async () => {
  assert((await C.call("POST", "/api/account/recovery-code", { password: "wrong-password" })).status === 401, "wrong password accepted");
  const r = await C.call("POST", "/api/account/recovery-code", { password: pw2 });
  assert(r.status === 200 && CODE.test(r.json.recoveryCode ?? ""), `${r.status} ${r.text}`);
  const old = await other.call("POST", "/api/auth/recover", { email, code: code2, password: pw3 });
  assert(old.status === 400, "replaced code still works");
});
await step("recovery is rate-limited per e-mail", async () => {
  let last = 0;
  for (let i = 0; i < 6; i++) last = (await other.call("POST", "/api/auth/recover", { email, code: "AAAAA-BBBBB-CCCCC-DDDDD", password: pw3 })).status;
  assert(last === 429, `last status ${last}`);
});

console.log("\n[4] Admin issues a code");
const ADMIN = new Client();
const emailAdmin = `ne-admin-${stamp}@example.test`;
await step("admin (granted with --no-email, MFA enrolled) issues a working code for the customer", async () => {
  await db.query("DELETE FROM rate_limits");
  const r = await ADMIN.call("POST", "/api/auth/register", { fullName: "Admin", email: emailAdmin, password: pw1, locale: "ar", acceptTerms: true });
  assert(r.status === 200, `register ${r.text}`);
  execFileSync("node", ["scripts/grant-admin.mts", emailAdmin, "--no-email"], { env: { ...process.env } });
  await ADMIN.call("POST", "/api/auth/logout");
  assert((await ADMIN.call("POST", "/api/auth/login", { email: emailAdmin, password: pw1 })).status === 200, "admin login");
  const setup = await ADMIN.call("POST", "/api/auth/mfa/setup");
  assert((await ADMIN.call("POST", "/api/auth/mfa/verify", { code: totp(setup.json.secret) })).status === 200, "mfa");
  const page = await ADMIN.call("GET", `/admin/users/${userId}`);
  assert(page.status === 200 && page.text.includes("إصدار رمز استعادة جديد"), `user page ${page.status}`);
  const issued = await ADMIN.call("POST", `/api/admin/users/${userId}`, { action: "recovery_code" });
  assert(issued.status === 200 && CODE.test(issued.json.recoveryCode ?? ""), `${issued.status} ${issued.text}`);
  const a = await db.query(`SELECT count(*)::int AS n FROM audit_log WHERE action = 'admin.user_recovery_code' AND target_id = $1`, [userId]);
  assert(a.rows[0].n === 1, "not audited");
  const use = await new Client().call("POST", "/api/auth/recover", { email, code: issued.json.recoveryCode, password: pw3 });
  assert(use.status === 200, `issued code refused: ${use.status} ${use.text}`);
});
await step("customers cannot issue codes for anyone", async () => {
  await C.call("POST", "/api/auth/login", { email, password: pw3 });
  const r = await C.call("POST", `/api/admin/users/${userId}`, { action: "recovery_code" });
  assert(r.status === 403, `status ${r.status}`);
});

console.log("\n[5] Clean-up");
await step("test accounts are deleted", async () => {
  assert((await C.call("POST", "/api/account/delete", { password: pw3 })).status === 200, "delete customer");
  await db.query(`DELETE FROM users WHERE email = $1`, [emailAdmin]);
});

await db.end();
console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.log(` - ${f}`);
  process.exit(1);
}
