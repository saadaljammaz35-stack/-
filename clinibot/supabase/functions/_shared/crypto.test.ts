import { assert, assertEquals, assertNotEquals, assertRejects } from "jsr:@std/assert@1.0.13";
import {
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
