import { assertEquals } from "jsr:@std/assert@1.0.13";
import { e164ToWaId, normalizeDigits, normalizePhone, waIdToE164 } from "./phone.ts";

Deno.test("Arabic-Indic digits become ASCII", () => {
  assertEquals(normalizeDigits("٠٥٥١٢٣٤٥٦٧"), "0551234567");
  assertEquals(normalizeDigits("۰۵۵"), "055");
});

Deno.test("Saudi local mobiles get the +966 prefix", () => {
  assertEquals(normalizePhone("0551234567"), "+966551234567");
  assertEquals(normalizePhone("055 123 4567"), "+966551234567");
  assertEquals(normalizePhone("551234567"), "+966551234567");
  assertEquals(normalizePhone("٠٥٥١٢٣٤٥٦٧"), "+966551234567");
});

Deno.test("international formats are kept", () => {
  assertEquals(normalizePhone("+966 55 123 4567"), "+966551234567");
  assertEquals(normalizePhone("00966551234567"), "+966551234567");
  assertEquals(normalizePhone("+44 20 7946 0958"), "+442079460958");
});

Deno.test("implausible numbers are refused", () => {
  assertEquals(normalizePhone("12"), null);
  assertEquals(normalizePhone("abc"), null);
  assertEquals(normalizePhone("+9665512345"), null);
  assertEquals(normalizePhone("+0551234567"), null);
});

Deno.test("WhatsApp IDs convert both ways", () => {
  assertEquals(waIdToE164("966551234567"), "+966551234567");
  assertEquals(waIdToE164("x"), null);
  assertEquals(e164ToWaId("+966551234567"), "966551234567");
});
