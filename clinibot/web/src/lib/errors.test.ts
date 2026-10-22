import { AuthApiError, AuthRetryableFetchError } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { translate } from "@/i18n/translate";
import type { TFunction } from "@/i18n";
import { ApiError } from "./api";
import { describeError, errorReference, errorText, isPermanentError } from "./errors";

const tAr: TFunction = (key, params) => translate("ar", key, params);
const tEn: TFunction = (key, params) => translate("en", key, params);

describe("errorText", () => {
  it("maps Edge Function codes in both languages", () => {
    const error = new ApiError({ status: 409, code: "seat_limit", message: "Seat limit" });
    expect(errorText(tEn, error)).toBe(translate("en", "errors.seat_limit"));
    expect(errorText(tAr, error)).toBe(translate("ar", "errors.seat_limit"));
  });

  it("uses retry_after_seconds for rate limits", () => {
    const error = new ApiError({
      status: 429,
      code: "rate_limited",
      message: "Too many",
      details: { retry_after_seconds: 42 },
    });
    expect(errorText(tEn, error)).toContain("42");
  });

  it("shows the rate-limit wait as an upper bound in seconds, minutes or hours", () => {
    const limited = (seconds: number) =>
      new ApiError({
        status: 429,
        code: "rate_limited",
        message: "Too many",
        details: { retry_after_seconds: seconds },
      });
    expect(errorText(tEn, limited(42))).toBe(
      "Too many requests in a short time. Wait up to 42 seconds, then try again.",
    );
    expect(errorText(tEn, limited(600))).toBe(
      "Too many requests in a short time. Wait up to 10 minutes, then try again.",
    );
    expect(errorText(tEn, limited(3600))).toBe(
      "Too many requests in a short time. Wait up to 1 hour, then try again.",
    );
    // Arabic plural forms come from Intl, with Latin digits.
    expect(errorText(tAr, limited(600))).toContain("مدة أقصاها 10 دقائق");
    expect(errorText(tAr, limited(120))).toContain("مدة أقصاها دقيقتان");
    expect(errorText(tAr, limited(3600))).toContain("مدة أقصاها ساعة");
    expect(errorText(tAr, limited(3600))).not.toContain("3600");
    // A partial minute rounds up: the text never promises less than the real wait.
    expect(errorText(tEn, limited(61))).toContain("2 minutes");
  });

  it("tells a timeout from a network failure", () => {
    const error = new ApiError({ status: 0, code: "timeout", message: "Request timed out" });
    expect(errorText(tEn, error)).toBe(translate("en", "errors.timeout"));
    expect(errorText(tAr, error)).toBe(translate("ar", "errors.timeout"));
  });

  it("falls back to errors.unknown for unknown codes, never server text", () => {
    const error = new ApiError({ status: 409, code: "something_new", message: "Internal detail" });
    expect(errorText(tEn, error)).toBe(translate("en", "errors.unknown"));
  });

  it("maps network failures", () => {
    const error = new ApiError({ status: 0, code: "network_error", message: "Failed to fetch" });
    expect(errorText(tEn, error)).toBe(translate("en", "errors.network_error"));
    expect(errorText(tEn, new TypeError("Failed to fetch"))).toBe(
      translate("en", "errors.network_error"),
    );
  });

  it("maps Postgres hints from RPCs before codes", () => {
    const cases: Array<[Record<string, string>, string]> = [
      [{ code: "23505", hint: "slug_taken", message: "taken" }, "slug_taken"],
      [{ code: "23514", hint: "org_limit", message: "limit" }, "org_limit"],
      [{ code: "23514", hint: "last_owner", message: "x" }, "last_owner"],
      [{ code: "23514", hint: "seat_limit", message: "x" }, "seat_limit"],
      [{ code: "23514", hint: "assistant_not_tested", message: "x" }, "assistant_not_tested"],
      [{ code: "42501", message: "forbidden" }, "forbidden"],
      [{ code: "23505", message: "duplicate" }, "unique_violation"],
      [{ code: "23514", message: "check" }, "check_violation"],
    ];
    for (const [error, code] of cases) {
      expect(describeError(error).code).toBe(code);
      expect(errorText(tAr, error)).toBe(translate("ar", `errors.${code}` as never));
    }
  });

  it("maps Supabase Auth errors", () => {
    expect(
      describeError(new AuthApiError("Invalid login credentials", 400, "invalid_credentials")).code,
    ).toBe("invalid_credentials");
    expect(
      describeError(new AuthApiError("Email not confirmed", 400, "email_not_confirmed")).code,
    ).toBe("email_not_confirmed");
    expect(describeError(new AuthApiError("Too many", 429, undefined)).code).toBe("rate_limited");
    expect(describeError(new AuthRetryableFetchError("Failed to fetch", 0)).code).toBe(
      "network_error",
    );
  });

  it("exposes the support reference", () => {
    const error = new ApiError({
      status: 500,
      code: "internal_error",
      message: "x",
      requestId: "req-1",
    });
    expect(errorReference(error)).toBe("req-1");
    expect(errorReference(new Error("x"))).toBeNull();
  });
});

describe("isPermanentError", () => {
  it("does not retry 4xx, retries transient failures", () => {
    expect(isPermanentError(new ApiError({ status: 403, code: "forbidden", message: "" }))).toBe(
      true,
    );
    expect(isPermanentError(new ApiError({ status: 429, code: "rate_limited", message: "" }))).toBe(
      false,
    );
    expect(
      isPermanentError(new ApiError({ status: 502, code: "upstream_error", message: "" })),
    ).toBe(false);
    expect(isPermanentError(new ApiError({ status: 0, code: "timeout", message: "" }))).toBe(false);
    expect(isPermanentError(new ApiError({ status: 0, code: "network_error", message: "" }))).toBe(
      false,
    );
    expect(isPermanentError({ code: "42501", message: "denied" })).toBe(true);
  });
});
