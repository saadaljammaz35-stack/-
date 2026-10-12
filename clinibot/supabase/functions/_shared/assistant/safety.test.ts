import { assertEquals } from "jsr:@std/assert@1.0.13";
import { detectLanguage } from "./language.ts";
import { checkPrices, detectCommand, detectEmergency, extractNumbers, extractPriceMentions } from "./safety.ts";

Deno.test("language: Arabic, English, mixed and letterless text", () => {
  assertEquals(detectLanguage("كم سعر تنظيف الأسنان؟"), "ar");
  assertEquals(detectLanguage("How much is teeth cleaning?"), "en");
  // A product name in English inside an Arabic sentence stays Arabic.
  assertEquals(detectLanguage("كم سعر Hollywood smile عندكم"), "ar");
  // A single Arabic word in an English sentence does not switch.
  assertEquals(detectLanguage("Hello, I want to book an appointment please شكرا"), "en");
  assertEquals(detectLanguage("0551234567", "en"), "en");
  assertEquals(detectLanguage("👍", null), "ar");
  assertEquals(detectLanguage("؟؟", "en"), "en");
});

Deno.test("commands: STOP in both languages, whole message only", () => {
  for (const text of ["STOP", "stop", " Stop. ", "إيقاف", "ايقاف", "توقف", "توقف!", "إِيقاف"]) {
    assertEquals(detectCommand(text), "stop", text);
  }
  for (const text of ["please stop calling me", "متى توقف العيادة عن العمل؟", "stopping", "ايقاف الحجز القديم"]) {
    assertEquals(detectCommand(text), null, text);
  }
});

Deno.test("commands: delete my data in both languages", () => {
  for (const text of ["DELETE MY DATA", "delete my data", "Delete  my data!", "حذف بياناتي", "احذف بياناتي", "أحذف بياناتي"]) {
    assertEquals(detectCommand(text), "delete", text);
  }
  assertEquals(detectCommand("how do I delete my data?"), null);
  assertEquals(detectCommand("أبي أعرف كيف أحذف بياناتي"), null);
});

Deno.test("emergency: English phrases", () => {
  for (
    const text of [
      "I have severe chest pain",
      "my father can't breathe",
      "She can’t breathe properly",
      "he is unconscious",
      "severe bleeding after extraction",
      "I think it's a stroke",
      "thinking about suicide",
      "took an overdose of pills",
      "my son is having a seizure",
      "food poisoning symptoms",
      "we had a car accident",
    ]
  ) {
    assertEquals(detectEmergency(text), true, text);
  }
});

Deno.test("emergency: Arabic phrases, with diacritics, tatweel and spelling variants", () => {
  for (
    const text of [
      "عندي ألم في الصدر",
      "عندي الم في الصدر من ساعة",
      "أبوي لا يستطيع التنفس",
      "لا أستطيع التنفس",
      "ما أقدر أتنفس",
      "عندي ضيق تنفس شديد",
      "فقد الوعي فجأة",
      "صار له إغماء",
      "نزيف شديد بعد الخلع",
      "أخاف تكون جلطة",
      "أفكر في الانتحار",
      "أريد أن أموت",
      "أخذ جرعة زائدة من الدواء",
      "ولدي عنده تشنج",
      "عندي تسمم",
      "صار لنا حادث",
      "نزيـــف شَديد",
    ]
  ) {
    assertEquals(detectEmergency(text), true, text);
  }
});

Deno.test("emergency: everyday clinic questions do not trigger", () => {
  for (
    const text of [
      "كم سعر تنظيف الأسنان؟",
      "أبي أكلم موظف في المحادثة",
      "محادثة سريعة عن المواعيد",
      "I accidentally booked twice",
      "What are your opening hours?",
      "Do you do teeth whitening?",
      "عندي ألم في السن",
    ]
  ) {
    assertEquals(detectEmergency(text), false, text);
  }
});

Deno.test("prices: amounts beside a currency marker, before or after", () => {
  assertEquals(extractPriceMentions("Cleaning costs 250 SAR."), [250]);
  assertEquals(extractPriceMentions("Price: SAR 1,200.50"), [1200.5]);
  assertEquals(extractPriceMentions("It is SR300 or 450 riyals"), [450, 300]);
  assertEquals(extractPriceMentions("سعر التنظيف 250 ريال"), [250]);
  assertEquals(extractPriceMentions("السعر ٢٥٠ ريالاً فقط"), [250]);
  assertEquals(extractPriceMentions("يبدأ من ١٬٥٠٠ ر.س"), [1500]);
  assertEquals(extractPriceMentions("التكلفة ٩٩٫٥ ريال"), [99.5]);
  assertEquals(extractPriceMentions("من 200 إلى 300 ريال"), [200, 300]);
  assertEquals(extractPriceMentions("200-300 SAR"), [200, 300]);
  assertEquals(extractPriceMentions("السعر 500 ﷼"), [500]);
});

Deno.test("prices: numbers that are not prices are ignored", () => {
  assertEquals(extractPriceMentions("Call 0551234567 or 997, open 9 to 21"), []);
  assertEquals(extractPriceMentions("أرسلت 3 رسائل"), []);
  assertEquals(extractPriceMentions("The session takes 45 minutes"), []);
});

Deno.test("price guard: allows published amounts, blocks others (English)", () => {
  assertEquals(checkPrices("Cleaning is 250 SAR and whitening starts from 1,500 SAR.", [250, 1500]), {
    ok: true,
    unknown: [],
  });
  assertEquals(checkPrices("Cleaning is 250.00 SAR", [250]).ok, true);
  assertEquals(checkPrices("Whitening is 999 SAR", [250, 1500]), { ok: false, unknown: [999] });
  assertEquals(checkPrices("We are open 9-21, call 0551234567", []).ok, true);
});

Deno.test("price guard: Arabic text with Arabic-Indic digits", () => {
  assertEquals(checkPrices("سعر التنظيف ٢٥٠ ريال", [250]).ok, true);
  assertEquals(checkPrices("سعر التبييض ١٬٢٠٠ ريال", [250, 1500]), { ok: false, unknown: [1200] });
  assertEquals(checkPrices("السعر ٢٤٩٫٩٩ ر.س", [250]), { ok: false, unknown: [249.99] });
  assertEquals(checkPrices("السعر ٢٤٩٫٩٩٩ ر.س", [250]).ok, true);
});

Deno.test("extractNumbers collects every amount a clinic wrote", () => {
  assertEquals(extractNumbers("الكشف ١٥٠ ريال، والمتابعة 75 خلال 14 يوم، والباقة 1,200"), [150, 75, 14, 1200]);
});
