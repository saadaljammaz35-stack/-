import { describe, expect, it } from "vitest";
import {
  isValidPhone,
  isValidSlug,
  normalizePhone,
  passwordStrength,
  safeNextPath,
  sanitizeSlugInput,
  slugify,
  toLatinDigits,
} from "./validation";

describe("slugs", () => {
  it("suggests a slug from a Latin name", () => {
    expect(slugify("Smile Dental Clinic")).toBe("smile-dental-clinic");
    expect(slugify("  Dr. Ali's  Clinic & Spa ")).toBe("dr-ali-s-clinic-and-spa");
    expect(slugify("Clínica Médica")).toBe("clinica-medica");
  });

  it("returns nothing for an Arabic-only name", () => {
    expect(slugify("عيادة الابتسامة")).toBe("");
  });

  it("keeps suggestions within 48 characters and not ending in a hyphen", () => {
    const slug = slugify("a".repeat(47) + " clinic");
    expect(slug.length).toBeLessThanOrEqual(48);
    expect(isValidSlug(slug)).toBe(true);
  });

  it("matches the database rule", () => {
    expect(isValidSlug("abc")).toBe(true);
    expect(isValidSlug("ab")).toBe(false);
    expect(isValidSlug("-abc")).toBe(false);
    expect(isValidSlug("abc-")).toBe(false);
    expect(isValidSlug("Abc")).toBe(false);
    expect(isValidSlug("a".repeat(48))).toBe(true);
    expect(isValidSlug("a".repeat(49))).toBe(false);
  });

  it("sanitises typed input", () => {
    expect(sanitizeSlugInput("My Clinic_1")).toBe("my-clinic-1");
    expect(sanitizeSlugInput("عيادة٣")).toBe("3");
  });
});

describe("phones", () => {
  it("normalises Saudi numbers to E.164", () => {
    expect(normalizePhone("055 123 4567")).toBe("+966551234567");
    expect(normalizePhone("٠٥٥١٢٣٤٥٦٧")).toBe("+966551234567");
    expect(normalizePhone("0112345678")).toBe("+966112345678");
    expect(normalizePhone("00966551234567")).toBe("+966551234567");
    expect(normalizePhone("966551234567")).toBe("+966551234567");
    expect(normalizePhone("551234567")).toBe("+966551234567");
    expect(normalizePhone("+44 7700 900123")).toBe("+447700900123");
  });

  it("drops a trunk 0 typed after the country code", () => {
    expect(normalizePhone("+966 055 123 4567")).toBe("+966551234567");
    expect(normalizePhone("00966 055 123 4567")).toBe("+966551234567");
  });

  it("refuses numbers the server rule would reject or that are ambiguous", () => {
    expect(normalizePhone("01 2345678")).toBeNull(); // 8 national digits
    expect(normalizePhone("966 12345678")).toBeNull();
    expect(normalizePhone("12345678")).toBeNull(); // no country code
    expect(normalizePhone("+9665512345")).toBeNull();
    expect(normalizePhone("+0551234567")).toBeNull();
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("abc")).toBeNull();
  });

  it("reads local landlines only for clinic numbers", () => {
    expect(normalizePhone("0112345678")).toBe("+966112345678");
    expect(normalizePhone("0112345678", { landlines: false })).toBeNull();
    expect(normalizePhone("0551234567", { landlines: false })).toBe("+966551234567");
  });

  it("returns only numbers the database accepts", () => {
    for (const input of ["055 123 4567", "+966 055 123 4567", "0112345678", "+44 20 7946 0958"]) {
      expect(isValidPhone(normalizePhone(input) ?? "")).toBe(true);
    }
  });

  it("validates with the database rule", () => {
    expect(isValidPhone("+966551234567")).toBe(true);
    expect(isValidPhone("12345")).toBe(false);
    expect(isValidPhone("+0123456789")).toBe(false);
  });

  it("converts Arabic-Indic digits", () => {
    expect(toLatinDigits("٠١٢٣٤٥٦٧٨٩ ۴")).toBe("0123456789 4");
  });
});

describe("passwordStrength", () => {
  it("is weak below the minimum length", () => {
    expect(passwordStrength("short")).toBe(0);
  });

  it("grows with length and variety", () => {
    expect(passwordStrength("abcdefghij")).toBe(1);
    expect(passwordStrength("Abcdefghijk1!x")).toBe(2);
    expect(passwordStrength("correct horse battery staple")).toBeGreaterThanOrEqual(2);
    expect(passwordStrength("Correct-Horse-Battery-9")).toBe(3);
  });

  it("treats trivial passwords as weak", () => {
    expect(passwordStrength("aaaaaaaaaaaa")).toBe(0);
    expect(passwordStrength("1234567890")).toBe(0);
  });
});

describe("safeNextPath", () => {
  it("allows same-site paths only", () => {
    expect(safeNextPath("/app/conversations?x=1")).toBe("/app/conversations?x=1");
    expect(safeNextPath("https://evil.example")).toBe("/app");
    expect(safeNextPath("//evil.example")).toBe("/app");
    expect(safeNextPath("/\\evil.example")).toBe("/app");
    expect(safeNextPath(null)).toBe("/app");
  });

  it("rejects control characters, backslashes and paths that resolve to another host", () => {
    expect(safeNextPath("/\t/evil.com")).toBe("/app");
    expect(safeNextPath("/\n/evil.com")).toBe("/app");
    expect(safeNextPath("/\r\\evil.com")).toBe("/app");
    expect(safeNextPath("/./\\evil.com")).toBe("/app");
    expect(safeNextPath("/.//evil.com")).toBe("/app");
    expect(safeNextPath("/a/..//evil.com")).toBe("/app");
  });

  it("keeps same-origin paths, returned unchanged", () => {
    expect(safeNextPath("/app/conversations?x=1")).toBe("/app/conversations?x=1");
    expect(safeNextPath("/%2F%2Fevil.com")).toBe("/%2F%2Fevil.com");
    expect(safeNextPath("/app/./staff")).toBe("/app/./staff");
  });
});
