import { describe, expect, it } from "vitest";
import { analysisSchema } from "@/lib/ai";
import { decrypt, encrypt, hashPassword, verifyPassword } from "@/lib/crypto";
import { mapFindings } from "@/lib/jobs";
import { detectMime } from "@/lib/media";
import { base32Decode, base32Encode, totpAt, verifyTotp } from "@/lib/totp";
import { signLocalGrant, verifyLocalGrant } from "@/lib/storage";

describe("passwords", () => {
  it("hashes with a random salt and verifies", async () => {
    const a = await hashPassword("correct horse battery");
    const b = await hashPassword("correct horse battery");
    expect(a).not.toEqual(b);
    expect(a.startsWith("scrypt$32768$8$1$")).toBe(true);
    expect(await verifyPassword("correct horse battery", a)).toBe(true);
    expect(await verifyPassword("wrong horse battery", a)).toBe(false);
    expect(await verifyPassword("anything", null)).toBe(false);
  });
});

describe("field encryption", () => {
  it("round-trips and detects tampering", () => {
    const c = encrypt("JBSWY3DPEHPK3PXP");
    expect(decrypt(c)).toBe("JBSWY3DPEHPK3PXP");
    const parts = c.split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(() => decrypt(parts.join("."))).toThrow();
  });
});

describe("TOTP (RFC 6238)", () => {
  // RFC 6238 Appendix B, SHA-1 secret "12345678901234567890".
  const secret = base32Encode(Buffer.from("12345678901234567890"));
  it("matches the RFC test vectors (last 6 digits)", () => {
    expect(totpAt(secret, 59_000)).toBe("287082");
    expect(totpAt(secret, 1111111109_000)).toBe("081804");
    expect(totpAt(secret, 1234567890_000)).toBe("005924");
    expect(totpAt(secret, 2000000000_000)).toBe("279037");
  });
  it("accepts ±1 step and rejects others", () => {
    const now = 1_700_000_000_000;
    expect(verifyTotp(secret, totpAt(secret, now - 30_000), now)).toBe(true);
    expect(verifyTotp(secret, totpAt(secret, now - 90_000), now)).toBe(false);
    expect(verifyTotp(secret, "12345", now)).toBe(false);
  });
  it("base32 round-trips", () => {
    expect(base32Decode(base32Encode(Buffer.from("hello world"))).toString()).toBe("hello world");
  });
});

describe("content sniffing", () => {
  it("detects by content, not by name", () => {
    expect(detectMime(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(detectMime(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(detectMime(Buffer.from("RIFF....WEBPVP8 "))).toBe("image/webp");
    expect(detectMime(Buffer.from("\0\0\0\x18ftypheic\0\0\0\0", "binary"))).toBe("image/heic");
    expect(detectMime(Buffer.from("\0\0\0\x18ftypisom\0\0\0\0", "binary"))).toBe("video/mp4");
    expect(detectMime(Buffer.from("\0\0\0\x14ftypqt  \0\0\0\0", "binary"))).toBe("video/quicktime");
    expect(detectMime(Buffer.from("<html><script>alert(1)</script>"))).toBeNull();
  });
});

describe("citations", () => {
  const base = {
    device_match: { matches_declared_device: "yes", observed_device: "phone", reasoning: "r" },
    evidence_quality: { rating: "good", issues: [] },
    overall_condition: "good",
    condition_score: 80,
    confidence: "medium",
    summary: "s",
    seller_claims_check: [],
    areas_not_covered: [],
    limitations: [],
    recommended_checks: [],
  } as const;
  it("keeps only findings that cite evidence that was actually sent", () => {
    const a = analysisSchema.parse({
      ...base,
      findings: [
        { area: "screen", severity: "minor", title: "scratch", detail: "d", confidence: "high", evidence_refs: ["E1", " e2 ", "E9"] },
        { area: "back", severity: "major", title: "invented", detail: "d", confidence: "high", evidence_refs: ["E77"] },
        { area: "ports", severity: "info", title: "none", detail: "d", confidence: "low", evidence_refs: [] },
      ],
    });
    const map = new Map([["E1", "id-1"], ["E2", "id-2"]]);
    const { findings, dropped } = mapFindings(a, map);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.evidenceIds).toEqual(["id-1", "id-2"]);
    expect(dropped).toBe(2);
  });
});

describe("local storage grants", () => {
  it("rejects forged and expired grants", () => {
    const g = signLocalGrant({ op: "get", key: "u/a/x.jpg", exp: Date.now() + 10_000 });
    expect(verifyLocalGrant(g)?.key).toBe("u/a/x.jpg");
    const [body] = g.split(".");
    const forged = Buffer.from(JSON.stringify({ op: "get", key: "u/b/x.jpg", exp: Date.now() + 10_000 })).toString("base64url");
    expect(verifyLocalGrant(`${forged}.${g.split(".")[1]}`)).toBeNull();
    expect(verifyLocalGrant(signLocalGrant({ op: "get", key: "k", exp: Date.now() - 1 }))).toBeNull();
    expect(body).toBeTruthy();
  });
});
