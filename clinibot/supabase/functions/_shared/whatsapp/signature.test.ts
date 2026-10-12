import { assert, assertEquals } from "jsr:@std/assert@1.0.13";
import { verifyMetaSignature } from "./signature.ts";

const SECRET = "app-secret-0123456789abcdef";
const RAW = new TextEncoder().encode(
  '{"object":"whatsapp_business_account","entry":[{"id":"1","changes":[{"field":"messages","value":{}}]}]}',
);

// Computed independently of _shared/crypto.ts so a bug there cannot hide here.
async function sign(body: Uint8Array<ArrayBuffer>, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, body));
  return "sha256=" + Array.from(mac, (b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.test("a signature over the raw body with the app secret is accepted", async () => {
  assert(await verifyMetaSignature(RAW, await sign(RAW, SECRET), SECRET));
});

Deno.test("upper-case hex and surrounding whitespace are accepted", async () => {
  const header = await sign(RAW, SECRET);
  assert(await verifyMetaSignature(RAW, `  sha256=${header.slice(7).toUpperCase()} `, SECRET));
});

Deno.test("a signature made with another secret is rejected", async () => {
  assertEquals(await verifyMetaSignature(RAW, await sign(RAW, "another-secret-value"), SECRET), false);
});

Deno.test("a body changed after signing is rejected", async () => {
  const header = await sign(RAW, SECRET);
  const tampered = new TextEncoder().encode(new TextDecoder().decode(RAW).replace('"1"', '"2"'));
  assertEquals(await verifyMetaSignature(tampered, header, SECRET), false);
});

Deno.test("re-serialised JSON does not verify: the raw bytes are what is signed", async () => {
  const header = await sign(RAW, SECRET);
  const reformatted = new TextEncoder().encode(JSON.stringify(JSON.parse(new TextDecoder().decode(RAW)), null, 2));
  assertEquals(await verifyMetaSignature(reformatted, header, SECRET), false);
});

Deno.test("missing and malformed headers are rejected without throwing", async () => {
  const valid = await sign(RAW, SECRET);
  const hex = valid.slice(7);
  for (
    const header of [
      null,
      "",
      hex,
      `sha1=${hex}`,
      `sha256=${hex.slice(0, 63)}`,
      `sha256=${hex}00`,
      `sha256=${"z".repeat(64)}`,
      `sha256=${hex},sha256=${hex}`,
    ]
  ) {
    assertEquals(await verifyMetaSignature(RAW, header, SECRET), false, String(header));
  }
});

Deno.test("an empty app secret never verifies", async () => {
  assertEquals(await verifyMetaSignature(RAW, await sign(RAW, "x"), ""), false);
});
