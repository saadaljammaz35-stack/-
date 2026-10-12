import { describe, expect, it } from "vitest";
import * as namespaces from "./messages";
import { interpolate, translate } from "./translate";
import type { Namespace } from "./types";

const REQUIRED_NAMESPACES = [
  "common",
  "auth",
  "onboarding",
  "marketing",
  "legal",
  "dashboard",
  "conversations",
  "appointments",
  "knowledge",
  "assistant",
  "whatsapp",
  "staff",
  "billing",
  "settings",
  "audit",
  "chat",
  "errors",
];

const entries = Object.entries(namespaces as Record<string, Namespace>);
const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("message catalog", () => {
  it("registers every required namespace", () => {
    expect(Object.keys(namespaces).sort()).toEqual([...REQUIRED_NAMESPACES].sort());
  });

  it.each(entries)("%s: ar and en have identical keys", (_name, ns) => {
    expect(Object.keys(ns.en).sort()).toEqual(Object.keys(ns.ar).sort());
  });

  it.each(entries)("%s: no empty strings", (_name, ns) => {
    for (const lang of ["ar", "en"] as const) {
      for (const [key, value] of Object.entries(ns[lang])) {
        expect(value.trim(), `${lang}.${key}`).not.toBe("");
      }
    }
  });

  it.each(entries)("%s: ar and en use the same {placeholders}", (_name, ns) => {
    for (const key of Object.keys(ns.ar)) {
      expect(placeholders(ns.en[key] ?? ""), key).toEqual(placeholders(ns.ar[key] ?? ""));
    }
  });
});

describe("translate", () => {
  it("returns the message in the requested language", () => {
    expect(translate("ar", "common.signIn")).toBe("تسجيل الدخول");
    expect(translate("en", "common.signIn")).toBe("Sign in");
  });

  it("interpolates {placeholders}", () => {
    expect(translate("en", "errors.rate_limited_retry", { seconds: 30 })).toContain("30 seconds");
    expect(interpolate("Hi {name}, {missing}", { name: "Rana" })).toBe("Hi Rana, {missing}");
  });

  it("returns the key itself for an unknown key", () => {
    // @ts-expect-error unknown keys are a type error, but must not crash at runtime
    expect(translate("en", "common.doesNotExist")).toBe("common.doesNotExist");
  });
});
