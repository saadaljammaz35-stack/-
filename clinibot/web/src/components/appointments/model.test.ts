import { describe, expect, it } from "vitest";
import {
  allowedNextStatuses,
  APPOINTMENT_STATUSES,
  canTransition,
  isFinalStatus,
  normalizeCustomerPhone,
  parseAppointmentSearch,
  serviceName,
} from "./model";

describe("appointment status transitions", () => {
  it("matches the database state machine exactly", () => {
    expect(allowedNextStatuses("new")).toEqual(["contacted", "confirmed", "cancelled"]);
    expect(allowedNextStatuses("contacted")).toEqual(["confirmed", "cancelled"]);
    expect(allowedNextStatuses("confirmed")).toEqual(["completed", "cancelled"]);
    expect(allowedNextStatuses("completed")).toEqual([]);
    expect(allowedNextStatuses("cancelled")).toEqual([]);
  });

  it("rejects everything else", () => {
    expect(canTransition("new", "completed")).toBe(false);
    expect(canTransition("contacted", "new")).toBe(false);
    expect(canTransition("confirmed", "contacted")).toBe(false);
    expect(canTransition("cancelled", "new")).toBe(false);
    expect(canTransition("completed", "cancelled")).toBe(false);
    for (const status of APPOINTMENT_STATUSES) expect(canTransition(status, status)).toBe(false);
  });

  it("knows the final statuses", () => {
    expect(isFinalStatus("completed")).toBe(true);
    expect(isFinalStatus("cancelled")).toBe(true);
    expect(isFinalStatus("confirmed")).toBe(false);
  });
});

describe("normalizeCustomerPhone (same rules as the server)", () => {
  it("turns local Saudi mobiles into E.164", () => {
    expect(normalizeCustomerPhone("0551234567")).toBe("+966551234567");
    expect(normalizeCustomerPhone("055 123 4567")).toBe("+966551234567");
    expect(normalizeCustomerPhone("551234567")).toBe("+966551234567");
    expect(normalizeCustomerPhone("(055) 123-4567")).toBe("+966551234567");
  });

  it("converts Arabic-Indic digits", () => {
    expect(normalizeCustomerPhone("٠٥٥١٢٣٤٥٦٧")).toBe("+966551234567");
    expect(normalizeCustomerPhone("۰۵۵۱۲۳۴۵۶۷")).toBe("+966551234567");
  });

  it("keeps international numbers", () => {
    expect(normalizeCustomerPhone("+966 55 123 4567")).toBe("+966551234567");
    expect(normalizeCustomerPhone("00966551234567")).toBe("+966551234567");
    expect(normalizeCustomerPhone("+44 7700 900123")).toBe("+447700900123");
  });

  it("rejects what cannot be a real number", () => {
    expect(normalizeCustomerPhone("")).toBeNull();
    expect(normalizeCustomerPhone("12345")).toBeNull();
    expect(normalizeCustomerPhone("abc")).toBeNull();
    expect(normalizeCustomerPhone("+9665512345")).toBeNull(); // Saudi number too short
    expect(normalizeCustomerPhone("0112345678")).toBeNull(); // server does not convert landlines
    expect(normalizeCustomerPhone("+0551234567")).toBeNull();
  });
});

describe("appointment search", () => {
  it("searches phone numbers by digits without the local 0", () => {
    expect(parseAppointmentSearch("055 123")).toEqual({ kind: "phone", value: "55123" });
    expect(parseAppointmentSearch("٠٥٥١")).toEqual({ kind: "phone", value: "551" });
  });

  it("searches names otherwise", () => {
    expect(parseAppointmentSearch("Rana")).toEqual({ kind: "name", value: "Rana" });
    expect(parseAppointmentSearch("   ")).toBeNull();
  });
});

describe("serviceName", () => {
  it("prefers the UI language and falls back to the other", () => {
    expect(serviceName({ name_ar: "تنظيف", name_en: "Cleaning" }, "en")).toBe("Cleaning");
    expect(serviceName({ name_ar: "تنظيف", name_en: null }, "en")).toBe("تنظيف");
    expect(serviceName(null, "ar")).toBe("");
  });
});
