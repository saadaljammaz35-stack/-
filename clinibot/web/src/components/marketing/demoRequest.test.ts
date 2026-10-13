import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/apiError";
import { validateForm } from "@/lib/useForm";
import {
  demoErrorView,
  demoRequestPayload,
  demoRequestSchema,
  EMPTY_DEMO_REQUEST,
  isDemoRequestCreated,
  normalizeDemoPhone,
  readContactEmail,
} from "./demoRequest";

const valid = {
  ...EMPTY_DEMO_REQUEST,
  clinic_name: "عيادة النور",
  contact_name: "سارة",
  phone: "055 123 4567",
  consent: true,
};

describe("normalizeDemoPhone (mirrors the server)", () => {
  it.each([
    ["0551234567", "+966551234567"],
    ["551234567", "+966551234567"],
    ["055 123 4567", "+966551234567"],
    ["٠٥٥١٢٣٤٥٦٧", "+966551234567"],
    ["+966 55 123 4567", "+966551234567"],
    ["00966551234567", "+966551234567"],
    ["+44 20 7946 0958", "+442079460958"],
    ["00971501234567", "+971501234567"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeDemoPhone(input)).toBe(expected);
  });

  it.each(["", "123", "0112345678", "+96655123456", "+9665512345678", "abc", "+0551234567"])(
    "rejects %s",
    (input) => {
      expect(normalizeDemoPhone(input)).toBeNull();
    },
  );
});

describe("demo request validation", () => {
  it("accepts the required fields alone", () => {
    expect(validateForm(demoRequestSchema, valid).ok).toBe(true);
  });

  it("reports each problem with its own message", () => {
    const result = validateForm(demoRequestSchema, {
      ...EMPTY_DEMO_REQUEST,
      clinic_name: "x",
      phone: "12",
      email: "not-an-email",
      message: "a".repeat(2001),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toEqual({
      clinic_name: "marketing.errClinicName",
      contact_name: "marketing.errContactName",
      phone: "marketing.errPhone",
      email: "marketing.errEmail",
      message: "marketing.errMessageTooLong",
      consent: "marketing.errConsent",
    });
  });

  it("asks for a phone number when it is empty", () => {
    const result = validateForm(demoRequestSchema, { ...valid, phone: "  " });
    expect(result.ok ? null : result.errors.phone).toBe("marketing.errPhoneRequired");
  });

  it("only accepts the clinic types the server accepts", () => {
    expect(validateForm(demoRequestSchema, { ...valid, clinic_type: "dental" }).ok).toBe(true);
    const result = validateForm(demoRequestSchema, { ...valid, clinic_type: "spa" });
    expect(result.ok ? null : result.errors.clinic_type).toBe("marketing.errClinicType");
  });
});

describe("demoRequestPayload", () => {
  it("sends trimmed values, an E.164 phone, the locale and the empty honeypot", () => {
    const result = validateForm(demoRequestSchema, { ...valid, clinic_name: "  عيادة النور  " });
    if (!result.ok) throw new Error("expected valid");
    expect(demoRequestPayload(result.data, "ar", "")).toEqual({
      clinic_name: "عيادة النور",
      contact_name: "سارة",
      phone: "+966551234567",
      email: "",
      city: "",
      clinic_type: "",
      message: "",
      locale: "ar",
      consent: true,
      website: "",
    });
  });
});

describe("isDemoRequestCreated", () => {
  it("is true only for the stored-row response", () => {
    expect(isDemoRequestCreated({ ok: true, id: "4f6c" })).toBe(true);
    expect(isDemoRequestCreated({ ok: true })).toBe(false);
    expect(isDemoRequestCreated({ ok: false, id: "x" })).toBe(false);
    expect(isDemoRequestCreated(null)).toBe(false);
    expect(isDemoRequestCreated("ok")).toBe(false);
  });
});

describe("demoErrorView", () => {
  it("maps 400 field errors onto the form fields", () => {
    const error = new ApiError({
      status: 400,
      code: "invalid_request",
      message: "Some fields are missing or invalid",
      details: [
        { path: "phone", message: "Enter a valid mobile number" },
        { path: "consent", message: "Consent is required" },
      ],
    });
    expect(demoErrorView(error)).toEqual({
      kind: "fields",
      fields: { phone: "marketing.errPhone", consent: "marketing.errConsent" },
    });
  });

  it("does not invent field errors for unknown paths (e.g. the honeypot)", () => {
    const error = new ApiError({
      status: 400,
      code: "invalid_request",
      message: "bad",
      details: [{ path: "website", message: "Must be empty" }],
      requestId: "req-1",
    });
    expect(demoErrorView(error)).toEqual({ kind: "other", requestId: "req-1" });
  });

  it("recognises rate limiting", () => {
    const error = new ApiError({
      status: 429,
      code: "rate_limited",
      message: "Too many",
      details: { retry_after_seconds: 3600 },
    });
    expect(demoErrorView(error)).toEqual({ kind: "rate_limited" });
  });

  it("recognises network failures", () => {
    expect(demoErrorView(new ApiError({ status: 0, code: "network_error", message: "x" }))).toEqual(
      {
        kind: "network",
      },
    );
    expect(demoErrorView(new TypeError("Failed to fetch"))).toEqual({ kind: "network" });
  });

  it("keeps the request id of other errors", () => {
    const error = new ApiError({
      status: 500,
      code: "internal_error",
      message: "x",
      requestId: "req-42",
    });
    expect(demoErrorView(error)).toEqual({ kind: "other", requestId: "req-42" });
  });
});

describe("readContactEmail", () => {
  it("returns the address only when one is configured", () => {
    expect(readContactEmail(undefined)).toBeNull();
    expect(readContactEmail("")).toBeNull();
    expect(readContactEmail("not an email")).toBeNull();
    expect(readContactEmail("  hello@clinibot.example ")).toBe("hello@clinibot.example");
  });
});
