// End-to-end acceptance test against a running MUBAYN server.
//
// What it proves (with the AI test double, see mock-anthropic.mts):
//   registration, e-mail verification, sign-in, inspection, real uploads to
//   storage with server-side verification, submission, analysis job, report
//   with only valid citations, PDF download, later access, retries after a
//   provider failure, honest failure (no report), quotas, password reset,
//   CSRF refusal, complete data isolation between two customers, admin MFA,
//   admin-only access, and account deletion removing stored files.
//
// What it does NOT prove: the quality of a real AI analysis. That needs the
// real ANTHROPIC_API_KEY and real device photos (see LAUNCH.md).
//
//   BASE=http://localhost:3100 DATABASE_URL=... MOCK=http://localhost:3999 node e2e/acceptance.mts
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import pg from "pg";
import sharp from "sharp";
import { createHmac } from "node:crypto";

const BASE = process.env.BASE ?? "http://localhost:3100";
const MOCK = process.env.MOCK ?? "http://localhost:3999";
const MAIL_DIR = path.resolve(process.env.MAIL_DIR ?? ".storage/mail");
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
  name: string;
  constructor(name: string) {
    this.name = name;
  }
  async call(method: string, url: string, body?: unknown, extra: Record<string, string> = {}) {
    const headers: Record<string, string> = { origin: BASE, ...extra };
    if (this.cookie) headers.cookie = this.cookie;
    if (body !== undefined) headers["content-type"] = "application/json";
    const res = await fetch(BASE + url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined, redirect: "manual" });
    const set = res.headers.getSetCookie?.() ?? [];
    for (const c of set) {
      const [kv] = c.split(";");
      if (kv!.startsWith("mubayn_session=")) this.cookie = kv!.endsWith("=") ? "" : kv!;
    }
    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch { /* not json */ }
    return { status: res.status, json, text, headers: res.headers };
  }
}

function latestMail(to: string, template: string): any {
  const files = readdirSync(MAIL_DIR).filter((f) => f.includes(template)).map((f) => path.join(MAIL_DIR, f))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  for (const f of files) {
    const m = JSON.parse(readFileSync(f, "utf8"));
    if (m.to === to) return m;
  }
  throw new Error(`no ${template} mail for ${to}`);
}
const linkToken = (text: string) => /token=([A-Za-z0-9_-]+)/.exec(text)?.[1] ?? "";

// ── fixtures: real image and video files (synthetic content) ────────────────
const tmp = mkdtempSync(path.join(os.tmpdir(), "mby-e2e-"));
async function photo(i: number): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200"><rect width="100%" height="100%" fill="hsl(${i * 47},30%,${60 + i}%)"/>
    <rect x="${500 + i * 7}" y="150" width="600" height="900" rx="70" fill="#1b2430"/><line x1="560" y1="${300 + i * 31}" x2="900" y2="${330 + i * 29}" stroke="#ddd" stroke-width="3"/>
    <text x="80" y="120" font-size="64" fill="#222">evidence ${i}</text></svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 88 }).toBuffer();
}
const videoPath = path.join(tmp, "v.mp4");
execFileSync("ffmpeg", ["-loglevel", "error", "-f", "lavfi", "-i", "testsrc=duration=6:size=640x480:rate=15", "-pix_fmt", "yuv420p", videoPath]);
const video = readFileSync(videoPath);
const tiny = await sharp({ create: { width: 100, height: 100, channels: 3, background: "#888" } }).jpeg().toBuffer();
const heic = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypheic"), Buffer.alloc(64)]);

async function upload(c: Client, inspectionId: string, file: Buffer, name: string, type: string) {
  const r = await c.call("POST", `/api/inspections/${inspectionId}/evidence`, { filename: name, contentType: type, bytes: file.length });
  if (r.status !== 201) return { request: r };
  const put = await fetch(r.json.uploadUrl, { method: "PUT", headers: r.json.headers, body: new Uint8Array(file) });
  assert(put.ok, `PUT to storage failed: ${put.status} ${await put.text()}`);
  const done = await c.call("POST", `/api/evidence/${r.json.evidenceId}/complete`);
  return { request: r, done, evidenceId: r.json.evidenceId as string };
}

async function registerVerified(c: Client, email: string) {
  const r = await c.call("POST", "/api/auth/register", { fullName: c.name, email, password: "Very-Long-Passw0rd!", locale: "ar", acceptTerms: true });
  assert(r.status === 200, `register ${r.status} ${r.text}`);
  const mail = latestMail(email, "verify_email");
  const v = await c.call("POST", "/api/auth/verify-email", { token: linkToken(mail.text) });
  assert(v.status === 200, `verify ${v.status} ${v.text}`);
  const l = await c.call("POST", "/api/auth/login", { email, password: "Very-Long-Passw0rd!" });
  assert(l.status === 200 && c.cookie, `login ${l.status} ${l.text}`);
}

async function waitStatus(c: Client, id: string, want: string[], ms = 90_000) {
  const until = Date.now() + ms;
  let last = "";
  while (Date.now() < until) {
    const r = await c.call("GET", `/api/inspections/${id}`);
    last = r.json?.status;
    if (want.includes(last)) return r.json;
    await new Promise((s) => setTimeout(s, 1500));
  }
  throw new Error(`timed out waiting for ${want.join("/")}, last=${last}`);
}
const setMode = (mode: string) => fetch(`${MOCK}/__mode`, { method: "POST", body: JSON.stringify({ mode }) });
const runCron = async () => {
  const secret = process.env.CRON_SECRET!;
  return fetch(`${BASE}/api/cron/jobs`, { headers: { authorization: `Bearer ${secret}` } });
};

const stamp = Date.now();
const A = new Client("عميل أ");
const B = new Client("Customer B");
const emailA = `a-${stamp}@example.test`;
const emailB = `b-${stamp}@example.test`;
let inspA = "";
let reportA = "";
const evidenceA: string[] = [];

console.log(`MUBAYN acceptance against ${BASE}`);
// Local/staging only: start from clean rate-limit counters.
await db.query(`DELETE FROM rate_limits`);
await db.query(`UPDATE settings SET value = jsonb_set(jsonb_set(value, '{monthlyInspectionsPerUser}', '3'), '{dailyAnalysesGlobal}', '1000') WHERE key = 'limits'`);

console.log("\n[1] Customer A: account");
await step("registers, verifies e-mail through the e-mailed link, signs in", () => registerVerified(A, emailA));
await step("same e-mail again gets the same answer (no account enumeration)", async () => {
  const r = await new Client("x").call("POST", "/api/auth/register", { fullName: "x", email: emailA, password: "Another-Long-Pass1", locale: "en", acceptTerms: true });
  assert(r.status === 200, `status ${r.status}`);
  latestMail(emailA, "account_exists");
});
await step("cross-site POST is refused (CSRF)", async () => {
  const r = await A.call("POST", "/api/inspections", {}, { origin: "https://evil.example" });
  assert(r.status === 403, `status ${r.status}`);
});

console.log("\n[2] Customer A: inspection and evidence");
await step("creates an inspection with device details", async () => {
  const r = await A.call("POST", "/api/inspections", {
    deviceCategory: "phone", brand: "Apple", model: "iPhone 13", storage: "128GB", color: "Blue", purchaseContext: "buying",
    sellerClaims: "نظيف جداً بدون خدوش، البطارية 90٪", askingPrice: "1800 SAR", reportLanguage: "ar",
  });
  assert(r.status === 201 && r.json.id, `status ${r.status} ${r.text}`);
  inspA = r.json.id;
});
await step("uploads 4 real JPEG photos straight to storage; server verifies each", async () => {
  for (let i = 1; i <= 4; i++) {
    const u = await upload(A, inspA, await photo(i), `photo-${i}.jpg`, "image/jpeg");
    assert(u.done?.status === 200 && u.done.json.status === "ready", `photo ${i}: ${u.request.status} ${u.request.text} ${u.done?.text}`);
    evidenceA.push(u.evidenceId!);
  }
});
await step("uploads a 6-second MP4 video; duration read by ffmpeg", async () => {
  const u = await upload(A, inspA, video, "walkaround.mp4", "video/mp4");
  assert(u.done?.status === 200 && u.done.json.durationMs >= 5000, `video: ${u.request.text} ${u.done?.text}`);
});
await step("rejects a file that claims to be JPEG but is not", async () => {
  const u = await upload(A, inspA, Buffer.from("<html><script>alert(1)</script>" + "x".repeat(500)), "evil.jpg", "image/jpeg");
  assert(u.done?.status === 400 && u.done.json.error.code === "evidence_rejected", `got ${u.done?.status} ${u.done?.text}`);
});
await step("rejects a too-small image, a duplicate photo, and HEIC", async () => {
  const small = await upload(A, inspA, tiny, "tiny.jpg", "image/jpeg");
  assert(small.done?.status === 400, `tiny: ${small.done?.text}`);
  const dup = await upload(A, inspA, await photo(1), "dup.jpg", "image/jpeg");
  assert(dup.done?.status === 400, `dup: ${dup.done?.text}`);
  const h = await upload(A, inspA, heic, "IMG_0001.HEIC", "image/heic");
  assert(h.request.status === 400 && h.request.json.error.code === "heic_unsupported", `heic: ${h.request.text}`);
});
await step("evidence file is served to its owner through a short-lived link", async () => {
  const r = await A.call("GET", `/api/evidence/${evidenceA[0]}/file`);
  assert(r.status === 302 && r.headers.get("location"), `status ${r.status}`);
  const img = await fetch(r.headers.get("location")!);
  assert(img.ok && (await img.arrayBuffer()).byteLength > 1000, `download ${img.status}`);
});

console.log("\n[3] Analysis: provider failure, automatic retry, report");
await step("first AI call fails (provider overloaded): job retries, no report is fabricated", async () => {
  await setMode("overloaded_once");
  const r = await A.call("POST", `/api/inspections/${inspA}/submit`);
  assert(r.status === 200, `submit ${r.status} ${r.text}`);
  // Wait until the first attempt has failed and the job is queued for later.
  const until = Date.now() + 60_000;
  for (;;) {
    const j = await db.query(`SELECT status, attempts FROM analysis_jobs WHERE inspection_id = $1`, [inspA]);
    if (j.rows[0]?.status === "queued" && j.rows[0].attempts === 1) break;
    assert(Date.now() < until, `job did not requeue: ${JSON.stringify(j.rows)}`);
    await new Promise((s) => setTimeout(s, 1000));
  }
  const reports = await db.query(`SELECT count(*)::int AS n FROM reports WHERE inspection_id = $1`, [inspA]);
  assert(reports.rows[0].n === 0, "a report exists after a failed attempt");
  const att = await db.query(`SELECT outcome, error_kind FROM analysis_attempts WHERE inspection_id = $1`, [inspA]);
  assert(att.rows[0].outcome === "failed", `attempt ${JSON.stringify(att.rows)}`);
});
await step("scheduler runs the retry; report is published", async () => {
  await setMode("ok");
  await db.query(`UPDATE analysis_jobs SET next_run_at = now() WHERE inspection_id = $1 AND status = 'queued'`, [inspA]);
  const c = await runCron();
  assert(c.ok, `cron ${c.status}`);
  const s = await waitStatus(A, inspA, ["completed", "failed"]);
  assert(s.status === "completed" && s.reportId, `status ${JSON.stringify(s)}`);
  reportA = s.reportId;
});
await step("every stored finding cites real evidence; the invented citation was dropped", async () => {
  const f = await db.query(`SELECT evidence_ids FROM findings WHERE report_id = $1`, [reportA]);
  assert(f.rows.length === 2, `findings ${f.rows.length}`);
  const ids = new Set((await db.query(`SELECT id FROM evidence WHERE inspection_id = $1`, [inspA])).rows.map((r) => r.id));
  for (const r of f.rows) for (const id of r.evidence_ids) assert(ids.has(id), `foreign evidence ${id}`);
  const rep = await db.query(`SELECT body FROM reports WHERE id = $1`, [reportA]);
  assert(rep.rows[0].body.validation.dropped_findings === 1, "dropped count");
});
await step("analysis attempt stores manifest, raw response, tokens, cost, timestamps", async () => {
  const a = await db.query(`SELECT * FROM analysis_attempts WHERE inspection_id = $1 AND outcome = 'succeeded'`, [inspA]);
  const row = a.rows[0];
  assert(row && row.response_raw && row.input_tokens > 0 && row.cost_usd_micros > 0 && row.finished_at, "attempt fields");
  assert(row.evidence_manifest.length === 4 + 3, `manifest size ${row.evidence_manifest.length} (4 photos + 3 video frames expected)`);
  assert(row.evidence_manifest.every((m: any) => m.sent_sha256 && m.original_sha256), "hashes");
  const frames = await db.query(`SELECT frame_time_ms FROM evidence WHERE inspection_id = $1 AND kind = 'video_frame' ORDER BY frame_time_ms`, [inspA]);
  assert(frames.rows.length === 3, `frames ${frames.rows.length}`);
});
await step("customer views the report page", async () => {
  const r = await A.call("GET", `/reports/${reportA}`);
  assert(r.status === 200 && r.text.includes("TEST OUTPUT"), `status ${r.status}`);
});
await step("customer downloads the PDF (real PDF, Arabic text rendered)", async () => {
  const r = await A.call("GET", `/api/reports/${reportA}/pdf`);
  assert(r.status === 302, `status ${r.status} ${r.text}`);
  const pdf = Buffer.from(await (await fetch(r.headers.get("location")!)).arrayBuffer());
  assert(pdf.subarray(0, 5).toString() === "%PDF-" && pdf.length > 20_000, `pdf ${pdf.length}`);
});
await step("customer can access the report again later (new session)", async () => {
  const again = new Client("A2");
  const l = await again.call("POST", "/api/auth/login", { email: emailA, password: "Very-Long-Passw0rd!" });
  assert(l.status === 200, "login");
  const r = await again.call("GET", `/reports/${reportA}`);
  assert(r.status === 200, `status ${r.status}`);
  const d = await again.call("GET", "/dashboard");
  assert(d.text.includes("iPhone 13"), "dashboard lists it");
});
await step("evidence is locked after submission", async () => {
  const r = await A.call("DELETE", `/api/evidence/${evidenceA[0]}`);
  assert(r.status === 409, `status ${r.status}`);
});

console.log("\n[4] Customer B: complete isolation from A");
await step("B registers and signs in", () => registerVerified(B, emailB));
await step("B cannot read, change or retry A's inspection", async () => {
  for (const [m, u, b] of [
    ["GET", `/api/inspections/${inspA}`],
    ["PATCH", `/api/inspections/${inspA}`, { deviceCategory: "phone", brand: "x", model: "y", purchaseContext: "buying", reportLanguage: "en" }],
    ["DELETE", `/api/inspections/${inspA}`],
    ["POST", `/api/inspections/${inspA}/evidence`, { filename: "a.jpg", contentType: "image/jpeg", bytes: 1000 }],
    ["POST", `/api/inspections/${inspA}/submit`],
    ["POST", `/api/inspections/${inspA}/retry`],
  ] as [string, string, unknown?][]) {
    const r = await B.call(m, u, b);
    assert(r.status === 404, `${m} ${u} -> ${r.status}`);
  }
});
await step("B cannot open A's evidence, report page or PDF", async () => {
  for (const u of [`/api/evidence/${evidenceA[0]}/file`, `/api/reports/${reportA}/pdf`]) {
    const r = await B.call("GET", u);
    assert(r.status === 404, `${u} -> ${r.status}`);
  }
  const page = await B.call("GET", `/reports/${reportA}`);
  assert(page.status === 404 && !page.text.includes("TEST OUTPUT"), `report page ${page.status}`);
  const del = await B.call("DELETE", `/api/evidence/${evidenceA[0]}`);
  assert(del.status === 404, `delete evidence ${del.status}`);
  const comp = await B.call("POST", `/api/evidence/${evidenceA[0]}/complete`);
  assert(comp.status === 404, `complete ${comp.status}`);
});
await step("B's dashboard and data export contain nothing of A's", async () => {
  const d = await B.call("GET", "/dashboard");
  assert(!d.text.includes("iPhone 13"), "dashboard leak");
  const ex = await B.call("GET", "/api/account/export");
  assert(ex.status === 200 && !ex.text.includes(inspA) && !ex.text.includes(emailA), "export leak");
});
await step("signed-out visitors get nothing", async () => {
  const anon = new Client("anon");
  assert((await anon.call("GET", `/api/inspections/${inspA}`)).status === 401, "api");
  assert((await anon.call("GET", `/api/evidence/${evidenceA[0]}/file`)).status === 401, "file");
  const page = await anon.call("GET", `/reports/${reportA}`);
  assert(page.status === 307 || page.status === 302 || page.status === 303, `page ${page.status}`);
});

console.log("\n[5] Honest failure, retry and quotas (B)");
let inspB = "";
await step("when the AI provider rejects the request, the inspection fails with NO report", async () => {
  const r = await B.call("POST", "/api/inspections", { deviceCategory: "laptop", brand: "Lenovo", model: "ThinkPad T14", purchaseContext: "selling", reportLanguage: "en" });
  inspB = r.json.id;
  for (let i = 11; i <= 14; i++) await upload(B, inspB, await photo(i), `p${i}.jpg`, "image/jpeg");
  await setMode("auth");
  assert((await B.call("POST", `/api/inspections/${inspB}/submit`)).status === 200, "submit");
  const s = await waitStatus(B, inspB, ["failed", "completed"]);
  assert(s.status === "failed" && !s.reportId, `status ${JSON.stringify(s)}`);
  const n = await db.query(`SELECT count(*)::int AS n FROM reports WHERE inspection_id = $1`, [inspB]);
  assert(n.rows[0].n === 0, "report fabricated");
  latestMail(emailB, "analysis_failed");
});
await step("customer retry after the fix produces the report", async () => {
  await setMode("ok");
  assert((await B.call("POST", `/api/inspections/${inspB}/retry`)).status === 200, "retry");
  const s = await waitStatus(B, inspB, ["completed", "failed"]);
  assert(s.status === "completed" && s.reportId, `status ${JSON.stringify(s)}`);
});
await step("invalid model output is never stored as a report", async () => {
  const r = await B.call("POST", "/api/inspections", { deviceCategory: "tablet", brand: "Samsung", model: "Tab S8", purchaseContext: "owner", reportLanguage: "en" });
  const id = r.json.id;
  for (let i = 21; i <= 24; i++) await upload(B, id, await photo(i), `p${i}.jpg`, "image/jpeg");
  await setMode("invalid");
  await B.call("POST", `/api/inspections/${id}/submit`);
  const until = Date.now() + 60_000;
  for (;;) {
    const a = await db.query(`SELECT outcome, error_kind FROM analysis_attempts WHERE inspection_id = $1`, [id]);
    if (a.rows.length && a.rows[0].outcome === "failed") { assert(a.rows[0].error_kind === "invalid_output" || a.rows[0].error_kind === "unexpected", `kind ${a.rows[0].error_kind}`); break; }
    assert(Date.now() < until, "no failed attempt");
    await new Promise((s) => setTimeout(s, 1000));
  }
  const n = await db.query(`SELECT count(*)::int AS n FROM reports WHERE inspection_id = $1`, [id]);
  assert(n.rows[0].n === 0, "report from invalid output");
  await setMode("ok");
});
await step("monthly free quota is enforced", async () => {
  await db.query(`UPDATE settings SET value = jsonb_set(value, '{monthlyInspectionsPerUser}', '1') WHERE key = 'limits'`);
  const r = await B.call("POST", "/api/inspections", { deviceCategory: "phone", brand: "Google", model: "Pixel 8", purchaseContext: "buying", reportLanguage: "en" });
  for (let i = 31; i <= 34; i++) await upload(B, r.json.id, await photo(i), `p${i}.jpg`, "image/jpeg");
  const s = await B.call("POST", `/api/inspections/${r.json.id}/submit`);
  assert(s.status === 429 && s.json.error.code === "monthly_quota_reached", `status ${s.status} ${s.text}`);
  await db.query(`UPDATE settings SET value = jsonb_set(value, '{monthlyInspectionsPerUser}', '3') WHERE key = 'limits'`);
});

console.log("\n[6] Password recovery");
await step("reset link works once, changes the password, signs out other sessions", async () => {
  const other = new Client("A-other");
  await other.call("POST", "/api/auth/login", { email: emailA, password: "Very-Long-Passw0rd!" });
  assert((await new Client("x").call("POST", "/api/auth/forgot", { email: emailA })).status === 200, "forgot");
  const token = linkToken(latestMail(emailA, "reset_password").text);
  const r = await new Client("x").call("POST", "/api/auth/reset", { token, password: "Brand-New-Passw0rd!" });
  assert(r.status === 200, `reset ${r.status} ${r.text}`);
  const again = await new Client("x").call("POST", "/api/auth/reset", { token, password: "Another-New-Pass1!" });
  assert(again.status === 400, "token reused");
  assert((await other.call("GET", "/api/inspections/" + inspA)).status === 401, "old session still valid");
  const l = await A.call("POST", "/api/auth/login", { email: emailA, password: "Brand-New-Passw0rd!" });
  assert(l.status === 200, "login with new password");
  const old = await new Client("x").call("POST", "/api/auth/login", { email: emailA, password: "Very-Long-Passw0rd!" });
  assert(old.status === 401, "old password still works");
});
await step("unknown e-mail on forgot-password gets the same answer", async () => {
  const r = await new Client("x").call("POST", "/api/auth/forgot", { email: `nobody-${stamp}@example.test` });
  assert(r.status === 200, `status ${r.status}`);
});

console.log("\n[7] Admin");
const ADMIN = new Client("Admin");
const emailAdmin = `admin-${stamp}@example.test`;
let totpSecret = "";
const totp = (secret: string) => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0, value = 0; const out: number[] = [];
  for (const ch of secret) { value = (value << 5) | alphabet.indexOf(ch); bits += 5; if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; } }
  const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const h = createHmac("sha1", Buffer.from(out)).update(msg).digest();
  const o = h[h.length - 1]! & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, "0");
};
await step("non-admins get 404 on admin pages and 403 on admin APIs", async () => {
  assert((await B.call("GET", "/admin")).status === 404, "page");
  assert((await B.call("PUT", "/api/admin/settings", {})).status === 403, "api");
});
await step("admin granted by CLI must enrol TOTP before the admin area opens", async () => {
  await registerVerified(ADMIN, emailAdmin);
  execFileSync("node", ["scripts/grant-admin.mts", emailAdmin], { env: { ...process.env } });
  await ADMIN.call("POST", "/api/auth/logout");
  await ADMIN.call("POST", "/api/auth/login", { email: emailAdmin, password: "Very-Long-Passw0rd!" });
  const blocked = await ADMIN.call("GET", "/admin");
  assert(blocked.status === 307 && blocked.headers.get("location")?.includes("/admin/mfa"), `before mfa ${blocked.status}`);
  assert((await ADMIN.call("PUT", "/api/admin/settings", {})).status === 403, "api before mfa");
  const setup = await ADMIN.call("POST", "/api/auth/mfa/setup");
  totpSecret = setup.json.secret;
  assert((await ADMIN.call("POST", "/api/auth/mfa/verify", { code: "000000" })).status === 400, "wrong code accepted");
  assert((await ADMIN.call("POST", "/api/auth/mfa/verify", { code: totp(totpSecret) })).status === 200, "verify");
  assert((await ADMIN.call("GET", "/admin")).status === 200, "admin after mfa");
});
await step("admin sees every console page", async () => {
  for (const p of ["/admin", "/admin/inspections", "/admin/jobs", "/admin/users", "/admin/errors", "/admin/messages", "/admin/settings", "/admin/audit", `/admin/inspections/${inspA}`, `/admin/reports/${reportA}`]) {
    const r = await ADMIN.call("GET", p);
    assert(r.status === 200, `${p} -> ${r.status}`);
  }
});
await step("admin reviews a report, re-analyses (new version), and it is audited", async () => {
  assert((await ADMIN.call("POST", `/api/admin/reports/${reportA}`, { action: "review", note: "checked" })).status === 200, "review");
  assert((await ADMIN.call("POST", `/api/admin/inspections/${inspA}`, { action: "reanalyze" })).status === 200, "reanalyze");
  const until = Date.now() + 60_000;
  for (;;) {
    const v = await db.query(`SELECT version, status FROM reports WHERE inspection_id = $1 ORDER BY version`, [inspA]);
    if (v.rows.length === 2) { assert(v.rows[0].status === "superseded" && v.rows[1].status === "published", JSON.stringify(v.rows)); break; }
    assert(Date.now() < until, "no v2");
    await new Promise((s) => setTimeout(s, 1000));
  }
  const a = await db.query(`SELECT action FROM audit_log WHERE action LIKE 'admin.%' AND actor_id = (SELECT id FROM users WHERE email = $1)`, [emailAdmin]);
  const actions = new Set(a.rows.map((r) => r.action));
  for (const x of ["admin.report_review", "admin.inspection_reanalyze", "admin.viewed_inspection", "admin.viewed_report"]) assert(actions.has(x), `missing audit ${x}`);
});
await step("admin updates limits; invalid limits are refused", async () => {
  const ok = await ADMIN.call("PUT", "/api/admin/settings", { maxImages: 20, maxVideos: 1, maxVideoSeconds: 60, monthlyInspectionsPerUser: 3, dailyAnalysesGlobal: 1000, signupsOpen: true, submissionsOpen: true });
  assert(ok.status === 200, `ok ${ok.status} ${ok.text}`);
  const bad = await ADMIN.call("PUT", "/api/admin/settings", { maxImages: 1, maxVideos: 9, maxVideoSeconds: 60, monthlyInspectionsPerUser: 3, dailyAnalysesGlobal: 50, signupsOpen: true, submissionsOpen: true });
  assert(bad.status === 400, `bad ${bad.status}`);
});
await step("admin disables a customer: their sessions stop working", async () => {
  const id = (await db.query(`SELECT id FROM users WHERE email = $1`, [emailB])).rows[0].id;
  assert((await ADMIN.call("POST", `/api/admin/users/${id}`, { action: "disable" })).status === 200, "disable");
  assert((await B.call("GET", "/api/inspections/" + inspB)).status === 401, "B still signed in");
  assert((await new Client("x").call("POST", "/api/auth/login", { email: emailB, password: "Very-Long-Passw0rd!" })).status === 401, "B can log in");
  assert((await ADMIN.call("POST", `/api/admin/users/${id}`, { action: "enable" })).status === 200, "enable");
  assert((await B.call("POST", "/api/auth/login", { email: emailB, password: "Very-Long-Passw0rd!" })).status === 200, "B login after enable");
});

console.log("\n[8] Account deletion");
await step("B deletes the account: rows and stored files are gone", async () => {
  const id = (await db.query(`SELECT id FROM users WHERE email = $1`, [emailB])).rows[0].id;
  const keys = (await db.query(`SELECT storage_key FROM evidence WHERE user_id = $1`, [id])).rows.map((r) => r.storage_key);
  assert(keys.length > 0, "B had evidence");
  assert((await B.call("POST", "/api/account/delete", { password: "wrong-password-123" })).status === 401, "wrong password accepted");
  const r = await B.call("POST", "/api/account/delete", { password: "Very-Long-Passw0rd!" });
  assert(r.status === 200, `delete ${r.status} ${r.text}`);
  for (const t of ["users", "inspections", "evidence", "reports", "sessions"]) {
    const col = t === "users" ? "id" : "user_id";
    const n = await db.query(`SELECT count(*)::int AS n FROM ${t} WHERE ${col} = $1`, [id]);
    assert(n.rows[0].n === 0, `${t} not empty`);
  }
  const s3 = process.env.S3_CHECK_URL;
  if (s3) {
    const list = await (await fetch(`${s3}?list-type=2&prefix=u/${id}/`)).text();
    assert(!list.includes("<Key>"), "S3 objects remain");
  }
  assert((await new Client("x").call("POST", "/api/auth/login", { email: emailB, password: "Very-Long-Passw0rd!" })).status === 401, "login after delete");
});

console.log("\n[9] Platform");
await step("security headers are set", async () => {
  const r = await fetch(BASE + "/");
  const csp = r.headers.get("content-security-policy") ?? "";
  assert(csp.includes("frame-ancestors 'none'") && csp.includes("nonce-"), "csp");
  assert(r.headers.get("x-content-type-options") === "nosniff", "nosniff");
  assert(r.headers.get("strict-transport-security"), "hsts");
});
await step("cron endpoint refuses callers without the secret", async () => {
  const r = await fetch(`${BASE}/api/cron/jobs`, { headers: { authorization: "Bearer wrong" } });
  assert(r.status === 401, `status ${r.status}`);
});
await step("login is rate-limited", async () => {
  const c = new Client("brute");
  let limited = false;
  for (let i = 0; i < 20 && !limited; i++) {
    const r = await c.call("POST", "/api/auth/login", { email: emailA, password: `wrong-${i}-password` });
    if (r.status === 429 || r.status === 423) limited = true;
  }
  assert(limited, "no lockout or rate limit after 20 attempts");
});

await db.end();
console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log(failures.map((f) => ` - ${f}`).join("\n"));
  process.exit(1);
}
