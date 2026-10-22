import { describe, expect, it } from "vitest";
import {
  detailsSchema,
  emptyToNull,
  isValidMapsUrl,
  OTHER_CITY,
  parseDays,
  privacySchema,
  profileSchema,
} from "./model";

describe("isValidMapsUrl", () => {
  it("accepts https map links", () => {
    expect(isValidMapsUrl("https://maps.app.goo.gl/abc123")).toBe(true);
    expect(isValidMapsUrl("https://www.google.com/maps/place/Riyadh")).toBe(true);
  });

  it("rejects http, other schemes, junk and over-long links", () => {
    expect(isValidMapsUrl("http://maps.app.goo.gl/abc")).toBe(false);
    expect(isValidMapsUrl("javascript:alert(1)")).toBe(false);
    expect(isValidMapsUrl("maps.app.goo.gl/abc")).toBe(false);
    expect(isValidMapsUrl("https://")).toBe(false);
    expect(isValidMapsUrl("https://localhost")).toBe(false);
    expect(isValidMapsUrl(`https://maps.example.com/${"a".repeat(500)}`)).toBe(false);
  });
});

describe("parseDays", () => {
  it("accepts whole numbers in range, including Arabic-Indic digits", () => {
    expect(parseDays("180", 7, 1825)).toBe(180);
    expect(parseDays(" ٣٦٥ ", 30, 3650)).toBe(365);
    expect(parseDays("7", 7, 1825)).toBe(7);
    expect(parseDays("1825", 7, 1825)).toBe(1825);
  });

  it("rejects out-of-range or non-integer input", () => {
    expect(parseDays("6", 7, 1825)).toBeNull();
    expect(parseDays("1826", 7, 1825)).toBeNull();
    expect(parseDays("30.5", 30, 3650)).toBeNull();
    expect(parseDays("", 30, 3650)).toBeNull();
    expect(parseDays("-40", 30, 3650)).toBeNull();
  });
});

describe("profileSchema", () => {
  it("normalises a Saudi phone to E.164 and maps the city", () => {
    const result = profileSchema.parse({
      name: "  عيادة الابتسامة ",
      city: "Riyadh",
      cityOther: "",
      phone: "055 123 4567",
      language: "ar",
    });
    expect(result).toEqual({
      name: "عيادة الابتسامة",
      city: "Riyadh",
      phone: "+966551234567",
      default_language: "ar",
    });
  });

  it("uses the typed city for 'other' and stores empty values as null", () => {
    const result = profileSchema.parse({
      name: "Smile",
      city: OTHER_CITY,
      cityOther: " Al Ula ",
      phone: "",
      language: "en",
    });
    expect(result.city).toBe("Al Ula");
    expect(result.phone).toBeNull();
    expect(
      profileSchema.parse({ name: "Smile", city: "", cityOther: "", phone: "", language: "en" })
        .city,
    ).toBeNull();
  });

  it("rejects an invalid phone", () => {
    const result = profileSchema.safeParse({
      name: "Smile",
      city: "",
      cityOther: "",
      phone: "12",
      language: "ar",
    });
    expect(result.success).toBe(false);
  });

  it("saves a dialable number and refuses ones the server's phone rule rejects", () => {
    const base = { name: "Smile", city: "", cityOther: "", language: "ar" as const };
    expect(profileSchema.parse({ ...base, phone: "+966 055 123 4567" }).phone).toBe(
      "+966551234567",
    );
    expect(profileSchema.safeParse({ ...base, phone: "01 2345678" }).success).toBe(false);
    expect(profileSchema.safeParse({ ...base, phone: "12345678" }).success).toBe(false);
  });
});

describe("detailsSchema", () => {
  it("maps fields to clinic_settings columns", () => {
    expect(
      detailsSchema.parse({
        displayNameAr: "عيادة",
        displayNameEn: "",
        addressAr: " الرياض ",
        addressEn: "",
        mapsUrl: " https://maps.app.goo.gl/x1 ",
        receptionPhone: "0112345678",
      }),
    ).toEqual({
      display_name_ar: "عيادة",
      display_name_en: null,
      address_ar: "الرياض",
      address_en: null,
      maps_url: "https://maps.app.goo.gl/x1",
      reception_phone: "+966112345678",
    });
  });

  it("refuses a non-https map link", () => {
    expect(
      detailsSchema.safeParse({
        displayNameAr: "",
        displayNameEn: "",
        addressAr: "",
        addressEn: "",
        mapsUrl: "http://maps.example.com",
        receptionPhone: "",
      }).success,
    ).toBe(false);
  });
});

describe("privacySchema", () => {
  it("parses retention days and keeps an empty notice as null (default notice)", () => {
    expect(
      privacySchema.parse({
        privacyAr: "",
        privacyEn: "Custom",
        messageDays: "90",
        appointmentDays: "٧٣٠",
      }),
    ).toEqual({
      privacy_notice_ar: null,
      privacy_notice_en: "Custom",
      message_retention_days: 90,
      appointment_retention_days: 730,
    });
  });

  it("enforces the database ranges", () => {
    const base = { privacyAr: "", privacyEn: "", messageDays: "180", appointmentDays: "365" };
    expect(privacySchema.safeParse({ ...base, messageDays: "5" }).success).toBe(false);
    expect(privacySchema.safeParse({ ...base, appointmentDays: "20" }).success).toBe(false);
    expect(privacySchema.safeParse({ ...base, privacyAr: "x".repeat(1001) }).success).toBe(false);
  });
});

describe("emptyToNull", () => {
  it("trims and nulls blanks", () => {
    expect(emptyToNull("   ")).toBeNull();
    expect(emptyToNull(" a ")).toBe("a");
  });
});
