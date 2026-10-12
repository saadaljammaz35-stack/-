import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1.0.13";
import {
  dataDeletedConfirmation,
  defaultWelcome,
  emergencyGuidance,
  isUnavailableNotice,
  optedOutConfirmation,
  privacyNotice,
  safeFallback,
  unavailableNotice,
} from "./notices.ts";

Deno.test("privacy notice: clinic name, retention and both commands; the clinic's own text wins", () => {
  const input = { clinicName: "عيادة الابتسامة", retentionDays: 90 };
  const ar = privacyNotice("ar", input);
  for (const part of ["عيادة الابتسامة", "90", "إيقاف", "STOP", "حذف بياناتي", "DELETE MY DATA"]) {
    assertStringIncludes(ar, part);
  }
  const en = privacyNotice("en", { ...input, clinicName: "Smile Clinic" });
  for (const part of ["Smile Clinic", "90 days", "STOP", "DELETE MY DATA", "حذف بياناتي"]) {
    assertStringIncludes(en, part);
  }
  assertEquals(privacyNotice("ar", { ...input, customAr: " نصنا الخاص " }), "نصنا الخاص");
  // A custom notice in the other language only does not replace this one.
  assertEquals(privacyNotice("en", { ...input, clinicName: "Smile Clinic", customAr: "نص" }), en);
});

Deno.test("emergency guidance: emergency number (997 by default) and reception alerted", () => {
  assertStringIncludes(emergencyGuidance("ar", null), "997");
  assertStringIncludes(emergencyGuidance("ar", null), "الاستقبال");
  assertStringIncludes(emergencyGuidance("en", "911"), "call 911");
  assertStringIncludes(emergencyGuidance("en", " "), "call 997");
  assertStringIncludes(emergencyGuidance("en", "997"), "reception");
});

Deno.test("fallback offers the reception phone only when known; unavailable notice is recognisable", () => {
  assertStringIncludes(safeFallback("en", "+966112345678"), "+966112345678");
  assert(!safeFallback("ar", null).includes("الاتصال بالاستقبال على"));
  assert(isUnavailableNotice(unavailableNotice("ar")));
  assert(isUnavailableNotice(unavailableNotice("en")));
  assert(!isUnavailableNotice("Thank you"));
  assert(!isUnavailableNotice(null));
});

Deno.test("confirmations and welcome exist in both languages", () => {
  for (const fn of [optedOutConfirmation, dataDeletedConfirmation, unavailableNotice]) {
    assert(/\p{Script=Arabic}/u.test(fn("ar")));
    assert(!/\p{Script=Arabic}/u.test(fn("en")));
  }
  assertStringIncludes(defaultWelcome("en", "Smile Clinic"), "Smile Clinic");
  assertStringIncludes(defaultWelcome("ar", "عيادة الابتسامة"), "عيادة الابتسامة");
});
