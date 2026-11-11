import { describe, expect, it } from "vitest";
import { redact, redactText } from "@/lib/security/redact";
import { detectPii } from "@/lib/security/pii";
import { assertPublicUrl, isBlockedIp } from "@/lib/security/ssrf";
import { safeFilename, sniffKnowledgeFile } from "@/lib/security/file-sniff";
import { openSecret, resolveSecretReference, sealSecret } from "@/lib/security/secrets";
import { hashPassword, passwordProblems, verifyPassword } from "@/lib/auth/password";
import { isApiKeyShape, newApiKey } from "@/lib/auth/tokens";

describe("redaction", () => {
  it("masks keys, tokens, DSN passwords and private keys", () => {
    const s = redactText(
      "key sk-proj-abcdefghijklmnopqrstuv hf_abcdefghijklmnopqrstuvwxyz postgres://u:hunter2@db/x eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.abcdefghijk Bearer abcdefghijklmnopqrstuvwxyz",
    );
    expect(s).not.toMatch(/sk-proj-abc|hf_abc|hunter2|eyJhbGci|Bearer abcdef/);
    expect(s).toContain("postgres://[REDACTED]@");
  });
  it("masks Luhn-valid card numbers but keeps ordinary long numbers", () => {
    expect(redactText("card 4111 1111 1111 1111")).toContain("[REDACTED_CARD]");
    expect(redactText("2^50 = 1125899906842624")).toContain("1125899906842624");
  });
  it("redacts sensitive keys in structured logs", () => {
    const r = redact({ password: "x", nested: { apiKey: "y", ok: "visible" }, list: ["sk-ant-abcdefghijklmnopqrstu"] });
    expect(r).toEqual({ password: "[REDACTED]", nested: { apiKey: "[REDACTED]", ok: "visible" }, list: ["[REDACTED_KEY]"] });
  });
});

describe("PII detection", () => {
  it("finds Saudi phone numbers, valid national IDs, IBANs, emails, cards and passwords", () => {
    const types = (s: string) => detectPii(s).map((f) => f.type);
    expect(types("جوالي 0551234567")).toContain("phone");
    expect(types("رقمي +966551234567")).toContain("phone");
    expect(types("الهوية 1000000008")).toContain("saudi_national_id"); // checksum-valid test number
    expect(types("الهوية 1000000001")).not.toContain("saudi_national_id"); // invalid checksum
    expect(types("IBAN SA0380000000608010167519")).toContain("iban");
    expect(types("IBAN SA03 8000 0000 6080 1016 7519")).toContain("iban");
    expect(types("mail me at a.b@example.com")).toContain("email");
    expect(types("كلمة المرور: Hunter22")).toContain("password");
    expect(types("4111111111111111")).toContain("payment_card");
  });
  it("does not flag ordinary text", () => {
    expect(detectPii("تأسست الشركة عام 2011 ولديها 120 موظفاً.")).toHaveLength(0);
  });
});

describe("SSRF guard", () => {
  it.each(["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"])(
    "blocks %s",
    (ip) => expect(isBlockedIp(ip)).toBe(true),
  );
  it.each(["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"])("allows %s", (ip) => expect(isBlockedIp(ip)).toBe(false));
  it("rejects internal hostnames, credentials, odd ports and non-http schemes", async () => {
    await expect(assertPublicUrl("http://localhost/x")).rejects.toThrow();
    await expect(assertPublicUrl("http://metadata.internal/")).rejects.toThrow();
    await expect(assertPublicUrl("https://user:pw@8.8.8.8/")).rejects.toThrow(/Credentials/);
    await expect(assertPublicUrl("https://8.8.8.8:22/")).rejects.toThrow(/Port/);
    await expect(assertPublicUrl("file:///etc/passwd")).rejects.toThrow();
    await expect(assertPublicUrl("http://169.254.169.254/latest/meta-data")).rejects.toThrow(/not allowed/);
    await expect(assertPublicUrl("http://8.8.8.8/", { httpsOnly: true })).rejects.toThrow(/https/);
    await expect(assertPublicUrl("https://8.8.8.8/")).resolves.toMatchObject({ address: "8.8.8.8" });
  });
});

describe("file sniffing", () => {
  const enc = (s: string) => new TextEncoder().encode(s);
  it("accepts files whose content matches their type", () => {
    expect(sniffKnowledgeFile("a.pdf", enc("%PDF-1.4 ...")).mime).toBe("application/pdf");
    expect(sniffKnowledgeFile("a.md", enc("# عنوان")).mime).toBe("text/markdown");
    expect(sniffKnowledgeFile("a.json", enc('{"a":1}')).mime).toBe("application/json");
    expect(sniffKnowledgeFile("a.jsonl", enc('{"a":1}\n{"b":2}\n')).mime).toBe("application/x-ndjson");
  });
  it("rejects mismatches, binaries, bad JSON and unknown types", () => {
    expect(sniffKnowledgeFile("a.docx", enc("%PDF-1.4")).ok).toBe(false);
    expect(sniffKnowledgeFile("a.pdf", enc("hello")).ok).toBe(false);
    expect(sniffKnowledgeFile("a.txt", new Uint8Array([0x4d, 0x5a, 0, 1, 2])).ok).toBe(false);
    expect(sniffKnowledgeFile("a.json", enc("{nope")).ok).toBe(false);
    expect(sniffKnowledgeFile("a.jsonl", enc('{"a":1}\nnot json')).reason).toMatch(/line 2/);
    expect(sniffKnowledgeFile("a.exe", enc("x")).ok).toBe(false);
    expect(sniffKnowledgeFile("a.txt", new Uint8Array()).ok).toBe(false);
  });
  it("strips paths and control characters from filenames", () => {
    expect(safeFilename("../../etc/passwd")).toBe("passwd");
    expect(safeFilename("C:\\Users\\x\\evil<>.pdf")).toBe("evil__.pdf");
  });
});

describe("secrets", () => {
  it("seals with AES-256-GCM and detects tampering", () => {
    process.env.OMNIX_SECRETS_KEY = Buffer.alloc(32, 9).toString("base64");
    const sealed = sealSecret("sk-real-key");
    expect(sealed).toMatch(/^enc:v1:/);
    expect(sealed).not.toContain("sk-real-key");
    expect(openSecret(sealed)).toBe("sk-real-key");
    const parts = sealed.split(":");
    parts[3] = parts[3]!.slice(0, -2) + (parts[3]!.endsWith("AA") ? "BB" : "AA");
    expect(() => openSecret(parts.join(":"))).toThrow();
  });
  it("only resolves allow-listed environment references", () => {
    process.env.OMNIX_PROVIDER_SECRET_TEST = "v";
    expect(resolveSecretReference("env:OMNIX_PROVIDER_SECRET_TEST")).toBe("v");
    expect(() => resolveSecretReference("env:DATABASE_URL")).toThrow();
  });
});

describe("passwords and keys", () => {
  it("hashes with scrypt and verifies", async () => {
    const h = await hashPassword("correct-horse-42");
    expect(h).toMatch(/^scrypt\$15\$8\$1\$/);
    expect(await verifyPassword("correct-horse-42", h)).toBe(true);
    expect(await verifyPassword("wrong-horse-42", h)).toBe(false);
  });
  it("enforces a minimal password policy", () => {
    expect(passwordProblems("short1")).not.toHaveLength(0);
    expect(passwordProblems("كلمةمرورطويلة1")).toHaveLength(0);
  });
  it("generates API keys with a public prefix", () => {
    const k = newApiKey();
    expect(isApiKeyShape(k.token)).toBe(true);
    expect(k.token.startsWith(`${k.prefix}_`)).toBe(true);
  });
});
