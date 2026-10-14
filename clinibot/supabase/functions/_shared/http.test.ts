import { assertEquals } from "jsr:@std/assert@1.0.13";
import { z } from "./deps.ts";
import { ConfigError } from "./env.ts";
import { handle, HttpError, parse, readJson } from "./http.ts";

function post(body: string, headers: Record<string, string> = {}) {
  return new Request("http://localhost/fn", {
    method: "POST",
    body,
    headers: { "content-type": "application/json", origin: "http://localhost:5173", ...headers },
  });
}

Deno.test("preflight returns 204 with CORS for an allowed origin", async () => {
  const res = await handle("t", () => Promise.resolve(new Response("x")))(
    new Request("http://localhost/fn", { method: "OPTIONS", headers: { origin: "http://localhost:5173" } }),
  );
  assertEquals(res.status, 204);
  assertEquals(res.headers.get("access-control-allow-origin"), "http://localhost:5173");
});

Deno.test("an unknown origin gets no CORS allowance", async () => {
  const res = await handle("t", () => Promise.resolve(new Response("x")))(
    new Request("http://localhost/fn", { method: "OPTIONS", headers: { origin: "https://evil.example" } }),
  );
  assertEquals(res.headers.get("access-control-allow-origin"), null);
});

Deno.test("configured origins tolerate pasted invisible characters, slashes and case", async () => {
  Deno.env.set("ALLOWED_ORIGINS", "\u200fHTTPS://Clinic.Example/ ,\n https://other.example\u200e");
  try {
    for (const origin of ["https://clinic.example", "https://other.example"]) {
      const res = await handle("t", () => Promise.resolve(new Response("x")))(
        new Request("http://localhost/fn", { method: "OPTIONS", headers: { origin } }),
      );
      assertEquals(res.headers.get("access-control-allow-origin"), origin);
    }
    const res = await handle("t", () => Promise.resolve(new Response("x")))(
      new Request("http://localhost/fn", { method: "OPTIONS", headers: { origin: "http://localhost:5173" } }),
    );
    // Once origins are configured, the development defaults no longer apply.
    assertEquals(res.headers.get("access-control-allow-origin"), null);
  } finally {
    Deno.env.delete("ALLOWED_ORIGINS");
  }
});

Deno.test("an origin a phone wrapped onto two lines is joined back", async () => {
  Deno.env.set("ALLOWED_ORIGINS", "https://clinibot-\nkappa.vercel.app\nhttps://www.clinic.example");
  try {
    for (const origin of ["https://clinibot-kappa.vercel.app", "https://www.clinic.example"]) {
      const res = await handle("t", () => Promise.resolve(new Response("x")))(
        new Request("http://localhost/fn", { method: "OPTIONS", headers: { origin } }),
      );
      assertEquals(res.headers.get("access-control-allow-origin"), origin);
    }
  } finally {
    Deno.env.delete("ALLOWED_ORIGINS");
  }
});

Deno.test("a lookalike origin is still rejected", async () => {
  Deno.env.set("ALLOWED_ORIGINS", "https://clinic.example");
  try {
    for (const origin of ["https://clinic.example.evil.test", "http://clinic.example", "https://clinic.example:8443"]) {
      const res = await handle("t", () => Promise.resolve(new Response("x")))(
        new Request("http://localhost/fn", { method: "OPTIONS", headers: { origin } }),
      );
      assertEquals(res.headers.get("access-control-allow-origin"), null);
    }
  } finally {
    Deno.env.delete("ALLOWED_ORIGINS");
  }
});

Deno.test("wrong method is rejected", async () => {
  const res = await handle("t", () => Promise.resolve(new Response("x")))(
    new Request("http://localhost/fn", { method: "GET" }),
  );
  assertEquals(res.status, 405);
});

Deno.test("HttpError becomes a JSON error body", async () => {
  const res = await handle("t", () => {
    throw new HttpError(403, "forbidden", "nope");
  })(post("{}"));
  assertEquals(res.status, 403);
  const body = await res.json();
  assertEquals(body.error, "forbidden");
  assertEquals(typeof body.request_id, "string");
});

Deno.test("missing configuration is a 503 that names the variable", async () => {
  const res = await handle("t", () => {
    throw new ConfigError("ANTHROPIC_API_KEY");
  })(post("{}"));
  assertEquals(res.status, 503);
  const body = await res.json();
  assertEquals(body.error, "not_configured");
  assertEquals(body.details.variable, "ANTHROPIC_API_KEY");
});

Deno.test("unexpected errors do not leak details", async () => {
  const res = await handle("t", () => {
    throw new Error("connection string postgres://secret");
  })(post("{}"));
  assertEquals(res.status, 500);
  const text = await res.text();
  assertEquals(text.includes("secret"), false);
});

Deno.test("readJson enforces the size cap", async () => {
  let status = 0;
  try {
    await readJson(post(JSON.stringify({ a: "x".repeat(2000) })), 100);
  } catch (error) {
    status = (error as HttpError).status;
  }
  assertEquals(status, 413);
});

Deno.test("readJson rejects malformed JSON", async () => {
  let code = "";
  try {
    await readJson(post("{nope"));
  } catch (error) {
    code = (error as HttpError).code;
  }
  assertEquals(code, "invalid_json");
});

Deno.test("parse reports field paths", () => {
  let details: unknown;
  try {
    parse(z.object({ email: z.email() }), { email: "x" });
  } catch (error) {
    details = (error as HttpError).details;
  }
  assertEquals((details as { path: string }[])[0]?.path, "email");
});
