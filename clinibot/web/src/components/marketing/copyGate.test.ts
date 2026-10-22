import { describe, expect, it } from "vitest";
import legal from "@/i18n/messages/legal";
import marketing from "@/i18n/messages/marketing";

/**
 * Copy gate for the public site: every string of the marketing and legal
 * namespaces, in Arabic and English, must pass these rules.
 */
const NAMESPACES = { marketing, legal } as const;

interface Entry {
  where: string;
  text: string;
}

const entries: Entry[] = Object.entries(NAMESPACES).flatMap(([ns, messages]) =>
  (["ar", "en"] as const).flatMap((lang) =>
    Object.entries(messages[lang] as Record<string, string>).map(([key, text]) => ({
      where: `${ns}.${lang}.${key}`,
      text,
    })),
  ),
);

function offenders(pattern: RegExp): string[] {
  return entries
    .filter(({ text }) => pattern.test(text))
    .map(({ where, text }) => `${where}: ${text}`);
}

describe("public site copy gate", () => {
  it("scans both languages of both namespaces", () => {
    expect(entries.length).toBeGreaterThan(200);
    expect(entries.some((entry) => entry.where.startsWith("legal.ar."))).toBe(true);
    expect(entries.some((entry) => entry.where.startsWith("marketing.en."))).toBe(true);
  });

  it("has no em dashes", () => {
    expect(offenders(/—/)).toEqual([]);
  });

  it("avoids hype words", () => {
    const hype =
      /\b(leverag\w*|seamless\w*|empower\w*|unlock\w*|robust\w*|actionable|data-driven|solutions?|journey\w*|(of|for) (the )?(future|tomorrow)|testament\w*|landscape\w*|delv(e|es|ed|ing)|elevat\w*)\b/i;
    expect(offenders(hype)).toEqual([]);
    // Arabic equivalents. "سلس" only before a space, so "سلسلة" (a series) still passes.
    expect(offenders(/حلول|حل ذكي|تمكين|بسلاسة|سلس(ة)?\s|رحلت|المستقبل|ثوري/)).toEqual([]);
  });

  it("has no 'not just X, it's Y' constructions", () => {
    expect(offenders(/\bnot (just|only|merely)\b/i)).toEqual([]);
    expect(offenders(/\bmore than (just|a mere)\b/i)).toEqual([]);
    expect(offenders(/ليس(ت)? مجرد|أكثر من مجرد|لا يقتصر|لا تقتصر/)).toEqual([]);
  });

  it("makes no social-proof, partnership or certification claims", () => {
    const english =
      /\b(trusted by|testimonials?|our (customers|clients|partners)|partners? with|used by|loved by|award\w*|certified|certification|compliant|compliance|accredited|ISO ?\d+|HIPAA|SOC ?2|GDPR|\d+\s*\+|\d[\d,]* (clinics|customers|users|patients))\b/i;
    const arabic =
      /يثق ب|موثوق من|شركاؤنا|شركائنا|بشراكة|عملاؤنا|عملائنا|آراء العملاء|شهادات العملاء|حاصل(ة)? على|معتمد(ة)? من|متوافق|امتثال|\d+\s*(عيادة|عيادات|عميل|عملاء|مستخدم)/;
    expect(offenders(english)).toEqual([]);
    expect(offenders(arabic)).toEqual([]);
  });

  it("uses only numbers that are real product facts", () => {
    // Trial length, emergency number, example price in the labelled mock,
    // retention defaults, VAT rate, field limits and the phone format hint.
    const allowed = new Set(["1", "2", "05", "14", "15", "180", "250", "365", "997", "2000"]);
    const unknown = entries.flatMap(({ where, text }) =>
      [...text.matchAll(/\d+(?:[.,]\d+)?/g)]
        .map((match) => match[0])
        .filter((number) => !allowed.has(number))
        .map((number) => `${where}: ${number}`),
    );
    expect(unknown).toEqual([]);
  });

  it("uses percentages only for the VAT rate", () => {
    const percentages = entries.flatMap(({ where, text }) =>
      [...text.matchAll(/\d+(?:[.,]\d+)?\s*%/g)]
        .map((match) => match[0].replace(/\s/g, ""))
        .filter((value) => value !== "15%")
        .map((value) => `${where}: ${value}`),
    );
    expect(percentages).toEqual([]);
  });

  it("labels the example conversation and the routing illustration as such", () => {
    expect(marketing.ar.mockLabel).toBe("مثال توضيحي");
    expect(marketing.en.mockLabel).toBe("Example");
    expect(marketing.ar.demoDisclaimer).toContain("ليس محادثة حية");
    expect(marketing.en.demoDisclaimer).toContain("not a live AI conversation");
  });

  it("says plainly that the clinic confirms appointments", () => {
    expect(marketing.ar.howNote).toContain("يؤكدها فريق العيادة");
    expect(marketing.en.howNote).toContain("confirmed by your clinic's team");
  });
});
