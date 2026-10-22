import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/apiError";
import { translate } from "@/i18n/translate";
import {
  EMPTY_CREDENTIALS,
  classifyConnectError,
  metaRejection,
  normalizeMetaId,
  qualityLabel,
  validateCredentials,
  validateTemplate,
  whatsappStatusView,
} from "./model";

describe("whatsappStatusView", () => {
  it("maps each status to its own label and tone", () => {
    expect(whatsappStatusView("disconnected")).toMatchObject({
      label: "whatsapp.statusDisconnected",
      tone: "neutral",
    });
    expect(whatsappStatusView("credentials_verified")).toMatchObject({
      label: "whatsapp.statusCredentialsVerified",
      tone: "warning",
    });
    expect(whatsappStatusView("connected")).toMatchObject({
      label: "whatsapp.statusConnected",
      tone: "success",
    });
    expect(whatsappStatusView("error")).toMatchObject({
      label: "whatsapp.statusError",
      tone: "danger",
    });
  });

  it("never shows Connected for anything but exactly 'connected'", () => {
    for (const status of [
      "credentials_verified",
      "error",
      "disconnected",
      "CONNECTED",
      "",
      null,
      undefined,
    ]) {
      const view = whatsappStatusView(status);
      expect(view.label, String(status)).not.toBe("whatsapp.statusConnected");
      expect(view.tone, String(status)).not.toBe("success");
    }
  });

  it("says plainly that credentials_verified is still waiting for Meta", () => {
    const label = translate("en", whatsappStatusView("credentials_verified").label);
    expect(label).toMatch(/waiting for Meta webhook verification/i);
    expect(translate("ar", whatsappStatusView("connected").label)).toBe("مربوط");
  });
});

const valid = {
  phone_number_id: "123 456 789 012",
  waba_id: "١٢٣٤٥٦٧٨٩",
  access_token: "  EAAGabcdefghijklmnopqrstuvwxyz0123  ",
  app_secret: "0123456789abcdef0123",
};

describe("validateCredentials", () => {
  it("normalises ids and trims secrets", () => {
    expect(validateCredentials(valid)).toEqual({
      ok: true,
      payload: {
        phone_number_id: "123456789012",
        waba_id: "123456789",
        access_token: "EAAGabcdefghijklmnopqrstuvwxyz0123",
        app_secret: "0123456789abcdef0123",
      },
    });
    expect(normalizeMetaId(" ٠١٢ 34 ")).toBe("01234");
  });

  it("requires every field", () => {
    const result = validateCredentials(EMPTY_CREDENTIALS);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.values(result.errors).map((error) => error.key)).toEqual([
        "whatsapp.errRequired",
        "whatsapp.errRequired",
        "whatsapp.errRequired",
        "whatsapp.errRequired",
      ]);
    }
  });

  it("rejects ids that are not 5–32 digits", () => {
    for (const id of ["1234", "12ab5", "1".repeat(33)]) {
      const result = validateCredentials({ ...valid, phone_number_id: id });
      expect(!result.ok && result.errors.phone_number_id?.key, id).toBe("whatsapp.errDigits");
    }
  });

  it("rejects secrets with odd characters or the wrong length", () => {
    const euro = validateCredentials({ ...valid, access_token: "EAAG€abcdefghijklmnopqrstu" });
    expect(!euro.ok && euro.errors.access_token?.key).toBe("whatsapp.errSecretChars");
    const huge = validateCredentials({ ...valid, app_secret: " ".repeat(600) });
    expect(!huge.ok && huge.errors.app_secret?.key).toBe("whatsapp.errLength");
    const short = validateCredentials({ ...valid, access_token: "EAAGshort" });
    expect(!short.ok && short.errors.access_token?.key).toBe("whatsapp.errLength");
    const arabic = validateCredentials({ ...valid, app_secret: "مفتاحمفتاحمفتاحمفتاح" });
    expect(!arabic.ok && arabic.errors.app_secret?.key).toBe("whatsapp.errSecretChars");
  });
});

describe("invisible characters (same cleaning as whatsapp-connect)", () => {
  it("normalizes ids wrapped in bidi marks or isolates, or containing zero-width spaces", () => {
    expect(normalizeMetaId("\u200E1234567890\u200F")).toBe("1234567890");
    expect(normalizeMetaId("\u20681234\u200B567890\u2069")).toBe("1234567890");
    const result = validateCredentials({
      ...valid,
      phone_number_id: "\u200E123456789012\u200F",
      waba_id: "\u2068123\u200B456789\u2069",
    });
    expect(result.ok && result.payload.phone_number_id).toBe("123456789012");
    expect(result.ok && result.payload.waba_id).toBe("123456789");
  });

  it("accepts tokens and secrets with a leading LRM, a trailing ZWSP or inner spaces, and sends them cleaned", () => {
    const result = validateCredentials({
      ...valid,
      access_token: "\u200EEAAG abc defghijklmnopqrstu\u200B",
      app_secret: "0123456789\nabcdef0123\u200B",
    });
    expect(result.ok).toBe(true);
    expect(result.ok && result.payload.access_token).toBe("EAAGabcdefghijklmnopqrstu");
    expect(result.ok && result.payload.app_secret).toBe("0123456789abcdef0123");
  });
});

describe("validateTemplate", () => {
  it("accepts a Meta template name and language, and an empty name as 'no template'", () => {
    expect(validateTemplate({ name: "appointment_confirmation", language: "ar" })).toEqual({
      ok: true,
      payload: {
        confirmation_template_name: "appointment_confirmation",
        confirmation_template_language: "ar",
      },
    });
    expect(validateTemplate({ name: "  ", language: "en_US" })).toEqual({
      ok: true,
      payload: { confirmation_template_name: null, confirmation_template_language: "en_US" },
    });
  });

  it("matches the database rules", () => {
    const upper = validateTemplate({ name: "Appointment-Confirm", language: "ar" });
    expect(!upper.ok && upper.errors.name?.key).toBe("whatsapp.errTemplateName");
    const language = validateTemplate({ name: "ok", language: "arabic" });
    expect(!language.ok && language.errors.language?.key).toBe("whatsapp.errTemplateLanguage");
  });
});

describe("whatsapp-connect errors", () => {
  const metaError = new ApiError({
    status: 502,
    code: "upstream_error",
    message: "WhatsApp (Meta) rejected the request",
    details: { provider: "meta", meta_code: 190, meta_message: "Error validating access token" },
    requestId: "req-1",
  });

  it("extracts Meta's code and message", () => {
    expect(metaRejection(metaError)).toEqual({
      code: 190,
      message: "Error validating access token",
    });
    expect(classifyConnectError(metaError)).toBe("meta_rejected");
  });

  it("recognises the other documented failures", () => {
    const api = (status: number, code: string, details?: unknown) =>
      new ApiError({ status, code, message: code, details });
    expect(classifyConnectError(api(409, "phone_number_in_use"))).toBe("phone_in_use");
    expect(
      classifyConnectError(api(503, "not_configured", { variable: "CREDENTIALS_ENCRYPTION_KEY" })),
    ).toBe("encryption_missing");
    expect(classifyConnectError(api(409, "whatsapp_not_connected"))).toBe("not_connected");
    expect(classifyConnectError(api(500, "internal_error"))).toBe("other");
    // An AI upstream error is not a Meta rejection.
    expect(metaRejection(api(502, "upstream_error", { provider: "anthropic" }))).toBeNull();
  });
});

describe("qualityLabel", () => {
  it("maps Meta's colours and falls back to unknown", () => {
    expect(qualityLabel("GREEN")).toBe("whatsapp.qualityHigh");
    expect(qualityLabel("yellow")).toBe("whatsapp.qualityMedium");
    expect(qualityLabel("RED")).toBe("whatsapp.qualityLow");
    expect(qualityLabel(null)).toBe("whatsapp.qualityUnknown");
    expect(qualityLabel("UNKNOWN")).toBe("whatsapp.qualityUnknown");
  });
});
