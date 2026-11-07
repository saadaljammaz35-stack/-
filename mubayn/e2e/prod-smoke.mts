// Smoke test against a deployed MUBAYN (no database access needed).
//   BASE=https://... node e2e/prod-smoke.mts start   → registers, signs in, creates an inspection, uploads 4 photos
//   (verify the test account's e-mail: open the link, or mark it in the database)
//   BASE=https://... node e2e/prod-smoke.mts submit  → submits and waits for the outcome
//   BASE=https://... node e2e/prod-smoke.mts cleanup → deletes the test account and everything in it
// State between steps is kept in $STATE (default ./.smoke-state.json).
import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const BASE = process.env.BASE!;
const STATE = process.env.STATE ?? ".smoke-state.json";
const step = process.argv[2];
type State = { email: string; password: string; cookie: string; inspectionId?: string };
const load = (): State => JSON.parse(readFileSync(STATE, "utf8"));
const save = (s: State) => writeFileSync(STATE, JSON.stringify(s, null, 2), { mode: 0o600 });

async function call(s: State | null, method: string, path: string, body?: unknown) {
  const headers: Record<string, string> = { origin: BASE };
  if (s?.cookie) headers.cookie = s.cookie;
  if (body !== undefined) headers["content-type"] = "application/json";
  const res = await fetch(BASE + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined, redirect: "manual" });
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const kv = c.split(";")[0]!;
    if (s && kv.includes("mubayn_session=")) s.cookie = kv;
  }
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* html */ }
  return { status: res.status, json, text, headers: res.headers };
}
const ok = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(msg);
  console.log(`  ✓ ${msg}`);
};

if (step === "start") {
  for (const p of ["/", "/faq", "/privacy", "/terms", "/ai-limits", "/contact", "/login", "/register"]) {
    const r = await call(null, "GET", p);
    ok(r.status === 200, `GET ${p} → 200`);
  }
  const home = await fetch(BASE + "/");
  ok((home.headers.get("content-security-policy") ?? "").includes("nonce-"), "CSP with nonce");
  ok(home.headers.get("strict-transport-security"), "HSTS");
  const s: State = { email: `smoke-${Date.now()}@example.com`, password: "Smoke-Test-Passw0rd!", cookie: "" };
  ok((await call(s, "POST", "/api/auth/register", { fullName: "Smoke Test", email: s.email, password: s.password, locale: "ar", acceptTerms: true })).status === 200, "register");
  ok((await call(s, "POST", "/api/auth/login", { email: s.email, password: s.password })).status === 200 && s.cookie, "sign in");
  ok((await call(s, "POST", "/api/inspections", {}, )).status === 400, "invalid inspection rejected");
  const c = await call(s, "POST", "/api/inspections", { deviceCategory: "phone", brand: "Test", model: "Smoke Device", purchaseContext: "owner", reportLanguage: "ar" });
  ok(c.status === 201, "create inspection");
  s.inspectionId = c.json.id;
  for (let i = 1; i <= 4; i++) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900"><rect width="100%" height="100%" fill="hsl(${i * 70},30%,65%)"/><rect x="420" y="100" width="360" height="700" rx="50" fill="#1b2430"/><text x="40" y="80" font-size="48">smoke ${i}</text></svg>`;
    const img = await sharp(Buffer.from(svg)).jpeg().toBuffer();
    const r = await call(s, "POST", `/api/inspections/${s.inspectionId}/evidence`, { filename: `smoke-${i}.jpg`, contentType: "image/jpeg", bytes: img.length });
    ok(r.status === 201, `presigned upload URL ${i}`);
    const put = await fetch(r.json.uploadUrl, { method: "PUT", headers: r.json.headers, body: new Uint8Array(img) });
    ok(put.ok, `PUT photo ${i} straight to object storage (${put.status})`);
    const done = await call(s, "POST", `/api/evidence/${r.json.evidenceId}/complete`);
    ok(done.status === 200 && done.json.status === "ready", `server verified photo ${i}`);
    if (i === 1) {
      const f = await call(s, "GET", `/api/evidence/${r.json.evidenceId}/file`);
      const dl = await fetch(f.headers.get("location")!);
      ok(f.status === 302 && dl.ok, "owner can open the photo through a short-lived link");
    }
  }
  const health = await (await fetch(BASE + "/api/health")).json();
  if (health.email === "none") {
    save(s);
    console.log("\nno e-mail on this deployment (accounts need no verification); run: submit");
  } else {
    const unverified = await call(s, "POST", `/api/inspections/${s.inspectionId}/submit`);
    ok(unverified.status === 403, "submission refused until the e-mail is verified");
    save(s);
    console.log(`\nverify ${s.email}, then run: submit`);
  }
} else if (step === "submit") {
  const s = load();
  const r = await call(s, "POST", `/api/inspections/${s.inspectionId}/submit`);
  ok(r.status === 200, `submit (${r.status} ${r.text.slice(0, 200)})`);
  let last = "";
  for (let i = 0; i < 60; i++) {
    const g = await call(s, "GET", `/api/inspections/${s.inspectionId}`);
    last = g.json?.status;
    if (last === "completed" || last === "failed") {
      console.log(`  → ${last}; report: ${g.json.reportId ?? "none"}; job: ${JSON.stringify(g.json.job)}`);
      if (g.json.reportId) {
        const page = await call(s, "GET", `/reports/${g.json.reportId}`);
        ok(page.status === 200, "report page opens for its owner");
        const pdf = await call(s, "GET", `/api/reports/${g.json.reportId}/pdf`);
        ok(pdf.status === 302, `PDF link issued (${pdf.status} ${pdf.text.slice(0, 200)})`);
        const bytes = Buffer.from(await (await fetch(pdf.headers.get("location")!)).arrayBuffer());
        ok(bytes.subarray(0, 5).toString() === "%PDF-", `PDF downloaded (${bytes.length} bytes)`);
        writeFileSync(`${STATE}.pdf`, bytes);
        const anon = await call(null, "GET", `/api/reports/${g.json.reportId}/pdf`);
        ok(anon.status === 401, "PDF refused without signing in");
      }
      break;
    }
    await new Promise((res) => setTimeout(res, 3000));
  }
  save(s);
} else if (step === "cleanup") {
  const s = load();
  const r = await call(s, "POST", "/api/account/delete", { password: s.password });
  ok(r.status === 200, `account deleted (${r.status})`);
  ok((await call(null, "POST", "/api/auth/login", { email: s.email, password: s.password })).status === 401, "deleted account can no longer sign in");
} else {
  console.log("usage: start | submit | cleanup");
}
