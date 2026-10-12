import { assert, assertEquals, assertThrows } from "jsr:@std/assert@1.0.13";
import { confirmationText, formatAppointmentTime } from "./format.ts";

// 13:30 UTC is 16:30 in Riyadh (UTC+3, no daylight saving).
const AT = "2026-10-20T13:30:00+00:00";

Deno.test("Arabic: Gregorian calendar with Latin digits in Riyadh time", () => {
  assertEquals(formatAppointmentTime(AT, "ar"), { date: "الثلاثاء، 20 أكتوبر 2026", time: "4:30 م" });
});

Deno.test("English: day month year and a 12-hour clock", () => {
  assertEquals(formatAppointmentTime(new Date(AT), "en"), { date: "Tuesday, 20 October 2026", time: "4:30 pm" });
});

Deno.test("no Arabic-Indic digits or Hijri months appear in Arabic output", () => {
  const { date, time } = formatAppointmentTime("2026-03-01T06:05:00Z", "ar");
  assertEquals(/[٠-٩]/.test(date + time), false);
  assert(date.includes("مارس"));
  assert(date.includes("2026"));
  assertEquals(time, "9:05 ص");
});

Deno.test("the clinic's time zone decides the day, and an unknown zone falls back to Riyadh", () => {
  const lateEvening = "2026-10-20T22:30:00Z";
  assertEquals(formatAppointmentTime(lateEvening, "en").date, "Wednesday, 21 October 2026");
  assertEquals(formatAppointmentTime(lateEvening, "en", "UTC").date, "Tuesday, 20 October 2026");
  assertEquals(formatAppointmentTime(lateEvening, "en", "Mars/Olympus"), formatAppointmentTime(lateEvening, "en"));
});

Deno.test("an invalid time is an error, not a made-up date", () => {
  assertThrows(() => formatAppointmentTime("not a time", "en"), RangeError);
});

const base = {
  clinicName: "عيادة الابتسامة",
  customerName: "سارة",
  serviceName: "تنظيف الأسنان",
  date: "الثلاثاء، 20 أكتوبر 2026",
  time: "4:30 م",
  address: "الرياض، حي العليا",
  receptionPhone: "+966112345678",
};

Deno.test("Arabic confirmation states the confirmation, details and how to reach reception", () => {
  const text = confirmationText({ ...base, language: "ar" });
  assertEquals(
    text,
    [
      "مرحباً سارة،",
      "تم تأكيد موعدك لدى عيادة الابتسامة.",
      "الخدمة: تنظيف الأسنان",
      "التاريخ: الثلاثاء، 20 أكتوبر 2026",
      "الوقت: 4:30 م",
      "العنوان: الرياض، حي العليا",
      "لتعديل الموعد أو إلغائه يرجى التواصل مع الاستقبال على الرقم ‎+966112345678.",
    ].join("\n"),
  );
});

Deno.test("English confirmation", () => {
  const text = confirmationText({
    ...base,
    language: "en",
    clinicName: "Smile Clinic",
    customerName: "Sara",
    serviceName: "Teeth cleaning",
    date: "Tuesday, 20 October 2026",
    time: "4:30 pm",
    address: "Olaya, Riyadh",
  });
  assertEquals(
    text,
    [
      "Hello Sara,",
      "Smile Clinic has confirmed your appointment.",
      "Service: Teeth cleaning",
      "Date: Tuesday, 20 October 2026",
      "Time: 4:30 pm",
      "Address: Olaya, Riyadh",
      "To change or cancel it, please contact reception on +966112345678.",
    ].join("\n"),
  );
});

Deno.test("missing service, address and phone are left out rather than invented", () => {
  const ar = confirmationText({ ...base, language: "ar", serviceName: null, address: "  ", receptionPhone: null });
  assertEquals(ar.includes("الخدمة"), false);
  assertEquals(ar.includes("العنوان"), false);
  assert(ar.endsWith("لتعديل الموعد أو إلغائه يرجى التواصل مع استقبال العيادة."));
  const en = confirmationText({ ...base, language: "en", serviceName: null, address: null, receptionPhone: null });
  assertEquals(en.includes("Service:"), false);
  assertEquals(en.includes("Address:"), false);
  assert(en.endsWith("please contact the clinic's reception."));
});
