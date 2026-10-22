import { assert, assertEquals, assertNotEquals, assertRejects } from "jsr:@std/assert@1.0.13";
import { ConfigError } from "./env.ts";
import {
  credentialsKey,
  decryptSecret,
  encryptSecret,
  hmacSha256Hex,
  importEncryptionKey,
  randomToken,
  sha256Hex,
  timingSafeEqual,
  toBase64,
} from "./crypto.ts";

const keyB64 = toBase64(new Uint8Array(32).map((_, i) => i + 1));

Deno.test("sha256Hex matches a known vector", async () => {
  assertEquals(await sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

Deno.test("hmacSha256Hex matches RFC 4231 test case 2", async () => {
  assertEquals(
    await hmacSha256Hex("Jefe", "what do ya want for nothing?"),
    "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843",
  );
});

Deno.test("timingSafeEqual compares exactly", () => {
  assert(timingSafeEqual("abc", "abc"));
  assert(!timingSafeEqual("abc", "abd"));
  assert(!timingSafeEqual("abc", "abcd"));
  assert(!timingSafeEqual("", "a"));
});

Deno.test("randomToken is URL safe and unique", () => {
  const a = randomToken();
  const b = randomToken();
  assertNotEquals(a, b);
  assert(/^[A-Za-z0-9_-]{43}$/.test(a));
});

Deno.test("encryption round-trips and is non-deterministic", async () => {
  const key = await importEncryptionKey(keyB64);
  const one = await encryptSecret("EAAG-secret-token", key, "integration-1");
  const two = await encryptSecret("EAAG-secret-token", key, "integration-1");
  assertNotEquals(one, two);
  assert(!one.includes("EAAG"));
  assertEquals(await decryptSecret(one, key, "integration-1"), "EAAG-secret-token");
});

Deno.test("a ciphertext moved to another row does not decrypt", async () => {
  const key = await importEncryptionKey(keyB64);
  const sealed = await encryptSecret("token", key, "integration-1");
  await assertRejects(() => decryptSecret(sealed, key, "integration-2"));
});

Deno.test("a tampered ciphertext does not decrypt", async () => {
  const key = await importEncryptionKey(keyB64);
  const sealed = await encryptSecret("token", key, "integration-1");
  const tampered = sealed.slice(0, -4) + (sealed.endsWith("AAAA") ? "BBBB" : "AAAA");
  await assertRejects(() => decryptSecret(tampered, key, "integration-1"));
});

Deno.test("keys of the wrong length are refused", async () => {
  await assertRejects(() => importEncryptionKey(toBase64(new Uint8Array(16))));
});

/** Answers the credentials_encryption_key RPC like PostgREST would. */
function stubRpc(answer: () => Response): { calls: number; restore: () => void } {
  const original = globalThis.fetch;
  const state = { calls: 0, restore: () => (globalThis.fetch = original) };
  globalThis.fetch = (input: Request | URL | string, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    if (!url.includes("/rest/v1/rpc/credentials_encryption_key")) return original(input, init);
    state.calls += 1;
    return Promise.resolve(answer());
  };
  return state;
}

Deno.test("credentialsKey: without a valid environment key, the database key is used", async () => {
  Deno.env.set("SUPABASE_URL", "https://project.supabase.co");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
  const databaseKey = toBase64(crypto.getRandomValues(new Uint8Array(32)));
  const rpc = stubRpc(() =>
    new Response(JSON.stringify(databaseKey), { headers: { "content-type": "application/json" } })
  );
  try {
    for (const env of [undefined, "too-short", "١٢٣ not ascii"]) {
      if (env === undefined) Deno.env.delete("CREDENTIALS_ENCRYPTION_KEY");
      else Deno.env.set("CREDENTIALS_ENCRYPTION_KEY", env);
      const key = await credentialsKey();
      // Sealed with the database key, so it opens with a key imported from the same bytes.
      const sealed = await encryptSecret("token", key, "row");
      assertEquals(await decryptSecret(sealed, await importEncryptionKey(databaseKey), "row"), "token");
    }
    // The database key is loaded once and then reused.
    assertEquals(rpc.calls, 1);
  } finally {
    rpc.restore();
    Deno.env.delete("CREDENTIALS_ENCRYPTION_KEY");
  }
});

Deno.test("credentialsKey: a valid environment key takes precedence over the database", async () => {
  const rpc = stubRpc(() => new Response("null", { headers: { "content-type": "application/json" } }));
  Deno.env.set("CREDENTIALS_ENCRYPTION_KEY", keyB64);
  try {
    const sealed = await encryptSecret("token", await credentialsKey(), "row");
    assertEquals(await decryptSecret(sealed, await importEncryptionKey(keyB64), "row"), "token");
    assertEquals(rpc.calls, 0);
  } finally {
    rpc.restore();
    Deno.env.delete("CREDENTIALS_ENCRYPTION_KEY");
  }
});

Deno.test("credentialsKey: no usable key anywhere is not_configured, and is retried next time", async () => {
  Deno.env.set("SUPABASE_URL", "https://project.supabase.co");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
  Deno.env.delete("CREDENTIALS_ENCRYPTION_KEY");
  const rpc = stubRpc(() =>
    new Response(JSON.stringify({ code: "PGRST202", message: "not found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    })
  );
  try {
    await assertRejects(() => credentialsKey(), ConfigError);
    await assertRejects(() => credentialsKey(), ConfigError);
    assertEquals(rpc.calls, 2);
  } finally {
    rpc.restore();
  }
});
