import { describe, expect, it } from "vitest";
import { formatDate, formatDuration, formatNumber, formatSar } from "./format";

describe("formatNumber", () => {
  it("uses Latin digits in Arabic", () => {
    expect(formatNumber("ar", 1234567)).toMatch(/^1[,٬]234[,٬]567$/);
    expect(formatNumber("ar", 1234567)).not.toMatch(/[٠-٩]/);
  });

  it("formats English", () => {
    expect(formatNumber("en", 1234.5)).toBe("1,234.5");
  });
});

describe("formatSar", () => {
  it("puts the riyal sign after the amount in Arabic", () => {
    expect(formatSar("ar", 299)).toBe("299 ر.س");
  });

  it("prefixes SAR in English", () => {
    expect(formatSar("en", 299)).toBe("SAR 299");
    expect(formatSar("en", 1499)).toBe("SAR 1,499");
  });

  it("shows two decimals only for fractional amounts", () => {
    expect(formatSar("en", 299.5)).toBe("SAR 299.50");
  });
});

describe("formatDuration", () => {
  it("uses seconds, then whole minutes, then hours, rounding up", () => {
    expect(formatDuration("en", 42)).toBe("42 seconds");
    expect(formatDuration("en", 60)).toBe("1 minute");
    expect(formatDuration("en", 600)).toBe("10 minutes");
    expect(formatDuration("en", 601)).toBe("11 minutes");
    expect(formatDuration("en", 3600)).toBe("1 hour");
    expect(formatDuration("en", 0)).toBe("1 second");
  });

  it("uses Arabic plural forms with Latin digits", () => {
    expect(formatDuration("ar", 60)).toBe("دقيقة");
    expect(formatDuration("ar", 120)).toBe("دقيقتان");
    expect(formatDuration("ar", 600)).toBe("10 دقائق");
    expect(formatDuration("ar", 3600)).toBe("ساعة");
    expect(formatDuration("ar", 30)).toBe("30 ثانية");
    expect(formatDuration("ar", 600)).not.toMatch(/[٠-٩]/);
  });
});

describe("formatDate", () => {
  it("uses the Gregorian calendar and Latin digits in Arabic", () => {
    const text = formatDate("ar", "2026-10-12");
    expect(text).toContain("2026");
    expect(text).toContain("12");
    expect(text).not.toMatch(/[٠-٩]/);
    expect(text).not.toContain("1448"); // Hijri year
  });

  it("does not shift date-only values across time zones", () => {
    expect(formatDate("en", "2026-01-01")).toBe("1 Jan 2026");
  });

  it("returns an empty string for invalid input", () => {
    expect(formatDate("en", "not a date")).toBe("");
  });
});
