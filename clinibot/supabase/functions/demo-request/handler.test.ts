import { assert, assertEquals } from "jsr:@std/assert@1.0.13";
import { sha256Hex } from "../_shared/crypto.ts";
import { handle } from "../_shared/http.ts";
import { FakeDb, type FakeDbOptions } from "../_shared/whatsapp/testing.ts";
import { createHandler } from "./handler.ts";

Deno.env.set("RATE_LIMIT_SALT", "test-salt");

const NOW = new Date("2026-10-12T09:00:00.000Z");
const IP = "203.0.113.7";

const VALID = {
  clinic_name: "عيادة الابتسامة",
  contact_name: "سارة العتيبي",
  phone: "٠٥٠ ١٢٣ ٤٥٦٧",
  email: "",
  city: "الرياض",
  clinic_type: "dental",
  message: "نود تجربة المساعد",
  locale: "ar",
  consent: true,
  website: "",
};

function request(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/demo-request", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `${IP}, 10.0.0.1`, ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function setup(options: FakeDbOptions = {}): FakeDb {
  return new FakeDb({ defaults: { demo_requests: () => ({ status: "new" }) }, ...options });
}

function run(db: FakeDb, req: Request): Promise<Response> {
  return handle("demo-request", createHandler(() => ({ db: db.db, now: () => NOW })))(req);
}

async function errorOf(res: Response): Promise<{ error: string; details: { path: string }[] }> {
  return await res.json();
}

Deno.test("stores the request and returns 201 with the stored row's id", async () => {
  const db = setup();
  const res = await run(db, request(VALID));
  assertEquals(res.status, 201);
  const body = await res.json();
  const rows = db.table("demo_requests");
  assertEquals(rows.length, 1);
  assertEquals(body, { ok: true, id: rows[0]!.id });

  const row = rows[0]!;
  // Arabic-Indic digits and a local 05… number become E.164.
  assertEquals(row.phone, "+966501234567");
  assertEquals(row.email, null);
  assertEquals(row.clinic_type, "dental");
  assertEquals(row.locale, "ar");
  assertEquals(row.consent_at, NOW.toISOString());
  assert(!("website" in row));
  assert(!("consent" in row));
});

Deno.test("normalises Saudi local numbers and keeps optional fields", async () => {
  for (
    const [phone, expected] of [
      ["0512345678", "+966512345678"],
      ["512345678", "+966512345678"],
      ["+966 51 234 5678", "+966512345678"],
      ["00966512345678", "+966512345678"],
    ]
  ) {
    const db = setup();
    const { website: _w, city: _c, message: _m, clinic_type: _t, ...minimal } = VALID;
    const res = await run(db, request({ ...minimal, phone, email: " owner@clinic.sa ", locale: "en" }));
    assertEquals(res.status, 201);
    const row = db.table("demo_requests")[0]!;
    assertEquals(row.phone, expected);
    assertEquals(row.email, "owner@clinic.sa");
    assertEquals(row.city, null);
    assertEquals(row.message, null);
    assertEquals(row.clinic_type, null);
  }
});

Deno.test("an invalid phone number is a field error on phone", async () => {
  for (const phone of ["12345", "05123", "0512345678901", "call me"]) {
    const db = setup();
    const res = await run(db, request({ ...VALID, phone }));
    assertEquals(res.status, 400);
    const body = await errorOf(res);
    assertEquals(body.error, "invalid_request");
    assertEquals(body.details.map((d) => d.path), ["phone"]);
    assertEquals(db.table("demo_requests").length, 0);
  }
});

Deno.test("a filled honeypot is rejected and nothing is stored", async () => {
  const db = setup();
  const res = await run(db, request({ ...VALID, website: "https://spam.example" }));
  assertEquals(res.status, 400);
  const body = await errorOf(res);
  assertEquals(body.error, "invalid_request");
  assertEquals(body.details.map((d) => d.path), ["website"]);
  assertEquals(db.table("demo_requests").length, 0);
  assertEquals(db.rpcs.length, 0);
});

Deno.test("consent must be literally true", async () => {
  for (const consent of [false, "true", 1, undefined]) {
    const db = setup();
    const res = await run(db, request({ ...VALID, consent }));
    assertEquals(res.status, 400);
    assertEquals((await errorOf(res)).details.map((d) => d.path), ["consent"]);
    assertEquals(db.table("demo_requests").length, 0);
  }
});

Deno.test("field limits and enums are enforced", async () => {
  for (
    const [patch, path] of [
      [{ clinic_name: "x" }, "clinic_name"],
      [{ clinic_name: "x".repeat(121) }, "clinic_name"],
      [{ contact_name: " " }, "contact_name"],
      [{ city: "x".repeat(81) }, "city"],
      [{ message: "x".repeat(2001) }, "message"],
      [{ clinic_type: "dentist" }, "clinic_type"],
      [{ locale: "fr" }, "locale"],
      [{ email: "not-an-email" }, "email"],
    ] as const
  ) {
    const db = setup();
    const res = await run(db, request({ ...VALID, ...patch }));
    assertEquals(res.status, 400, path);
    assertEquals((await errorOf(res)).details.map((d) => d.path), [path]);
    assertEquals(db.table("demo_requests").length, 0);
  }
});

Deno.test("an oversized body is rejected before parsing", async () => {
  const db = setup();
  const res = await run(db, request({ ...VALID, padding: "x".repeat(17 * 1024) }));
  assertEquals(res.status, 413);
  assertEquals((await res.json()).error, "payload_too_large");
  assertEquals(db.table("demo_requests").length, 0);
});

Deno.test("invalid JSON is a 400", async () => {
  const res = await run(setup(), request("{not json"));
  assertEquals(res.status, 400);
  assertEquals((await res.json()).error, "invalid_json");
});

Deno.test("the rate-limit key and stored ip_hash use the salted IP hash, never the raw IP", async () => {
  const db = setup();
  const res = await run(db, request(VALID));
  assertEquals(res.status, 201);
  const hash = await sha256Hex(`test-salt:${IP}`);
  const limiter = db.rpcs.find((r) => r.fn === "consume_rate_limit");
  assertEquals(limiter?.args, { p_key: `demo:${hash}`, p_limit: 5, p_window_seconds: 3600 });
  assertEquals(db.table("demo_requests")[0]!.ip_hash, hash);
  assert(!JSON.stringify(db.rpcs).includes(IP));
  assert(!JSON.stringify(db.calls).includes(IP));
});

Deno.test("over the limit is a 429 and nothing is stored", async () => {
  const db = setup({ rateLimited: true });
  const res = await run(db, request(VALID));
  assertEquals(res.status, 429);
  assertEquals((await res.json()).error, "rate_limited");
  assertEquals(db.table("demo_requests").length, 0);
});

Deno.test("a failed insert is never reported as success", async () => {
  const db = setup({
    fail: (call) => call.table === "demo_requests" ? { code: "23514", message: "check constraint" } : null,
  });
  const res = await run(db, request(VALID));
  assertEquals(res.status, 500);
  const body = await res.json();
  assertEquals(body.error, "database_error");
  assert(!("ok" in body));
});

Deno.test("blank or null optional fields are stored as null", async () => {
  const db = setup();
  const res = await run(db, request({ ...VALID, email: "   ", city: null, clinic_type: "", message: " " }));
  assertEquals(res.status, 201);
  const row = db.table("demo_requests")[0]!;
  assertEquals([row.email, row.city, row.clinic_type, row.message], [null, null, null, null]);
});
