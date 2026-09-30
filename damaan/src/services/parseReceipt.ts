import { toISODate } from '../domain/dates';

/**
 * Pulls the three fields worth pre-filling out of a receipt's recognised text:
 * the total, the purchase date and the shop's name. Saudi receipts mix Arabic
 * labels with Latin digits, print dates in several orders, and put the shop
 * name anywhere in the top few lines — so each extractor is deliberately
 * forgiving and every result stays editable in the form.
 */
export type ParsedReceipt = {
  merchant: string | null;
  totalMinor: number | null;
  purchaseDate: string | null;
  vatNumber: string | null;
};

/** Arabic-Indic and Persian digits to ASCII, and the Arabic decimal separator. */
export function normalizeDigits(input: string): string {
  return input
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/٫/g, '.')
    .replace(/٬/g, ',');
}

const TOTAL_LABELS = [
  'الإجمالي', 'الاجمالي', 'إجمالي', 'اجمالي', 'المجموع', 'مجموع',
  'الصافي', 'المبلغ المستحق', 'الإجمالي شامل', 'الاجمالي شامل', 'شامل الضريبة',
  'grand total', 'total amount', 'total due', 'amount due', 'net total', 'total',
];

/**
 * Labels whose number is never the total, whatever else the line says. A line
 * reading «المجموع قبل الضريبة» carries a total label too, so these have to win.
 */
const HARD_EXCLUDED = [
  'قبل الضريبة', 'ضريبة القيمة', 'المجموع الفرعي', 'المدفوع', 'الباقي', 'الخصم',
  'subtotal', 'sub total', 'discount', 'change', 'paid', 'tendered',
];

/**
 * Labels that only disqualify a line when nothing marks it as the total. The
 * grand total is often printed as «الإجمالي شامل الضريبة» — tax-inclusive, and
 * exactly the figure we want.
 */
const SOFT_EXCLUDED = ['الضريبة', 'vat', 'tax'];

const AMOUNT = /(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/g;

function amountsIn(line: string): number[] {
  const found: number[] = [];
  for (const match of line.matchAll(AMOUNT)) {
    const raw = match[1]!.replace(/,/g, '');
    const value = Number(raw);
    // A bare integer with no decimals and more than 6 digits is an ID, not money.
    if (Number.isFinite(value) && value > 0 && raw.replace('.', '').length <= 9) found.push(value);
  }
  return found;
}

/**
 * Looks for a total on a line carrying a total label, skipping lines labelled
 * as VAT or a subtotal. Falls back to the largest plausible amount, because on
 * almost every receipt the total is the biggest number printed.
 */
export function extractTotalMinor(lines: string[]): number | null {
  const normalized = lines.map((line) => normalizeDigits(line));
  const lowered = normalized.map((line) => line.toLowerCase());

  const hasTotalLabel = (line: string) => TOTAL_LABELS.some((label) => line.includes(label));
  const disqualified = (line: string) =>
    HARD_EXCLUDED.some((label) => line.includes(label)) ||
    (SOFT_EXCLUDED.some((label) => line.includes(label)) && !hasTotalLabel(line));

  for (let index = 0; index < normalized.length; index += 1) {
    const line = lowered[index]!;
    if (disqualified(line) || !hasTotalLabel(line)) continue;

    // The figure usually sits on the label's line; sometimes on the next one.
    const candidates = amountsIn(normalized[index]!);
    const fallback = index + 1 < normalized.length ? amountsIn(normalized[index + 1]!) : [];
    const chosen = candidates.length > 0 ? candidates : fallback;
    if (chosen.length > 0) return Math.round(Math.max(...chosen) * 100);
  }

  // Nothing was labelled. On almost every receipt the total is the largest
  // amount printed, once the lines that are definitely not it are dropped.
  const everything = normalized.flatMap((line, index) => (disqualified(lowered[index]!) ? [] : amountsIn(line)));
  if (everything.length === 0) return null;

  return Math.round(Math.max(...everything) * 100);
}

const DATE_PATTERNS = [
  /(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/, // yyyy-mm-dd
  /(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/, // dd-mm-yyyy or mm-dd-yyyy
  /(\d{1,2})[-/.](\d{1,2})[-/.](\d{2})(?!\d)/, // dd-mm-yy
];

function validDate(year: number, month: number, day: number, today: Date): Date | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const date = new Date(year, month - 1, day);
  // Reject a rolled-over date such as 31 February.
  if (date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  // A receipt cannot be from the future, nor from before receipts had barcodes.
  if (date.getTime() > today.getTime() || year < 2000) return null;

  return date;
}

/**
 * Reads the first date that could be a purchase date. Day-first is assumed
 * because that is the Saudi convention, unless the numbers only make sense
 * the other way round.
 */
export function extractPurchaseDate(lines: string[], today: Date = new Date()): string | null {
  const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

  for (const raw of lines) {
    const line = normalizeDigits(raw);

    for (let pattern = 0; pattern < DATE_PATTERNS.length; pattern += 1) {
      const match = DATE_PATTERNS[pattern]!.exec(line);
      if (!match) continue;

      const [, first, second, third] = match.map(Number) as [number, number, number, number];

      if (pattern === 0) {
        const date = validDate(first, second, third, endOfToday);
        if (date) return toISODate(date);
        continue;
      }

      const year = pattern === 2 ? 2000 + third : third;
      // Day-first unless the first number cannot be a month and the second can.
      const dayFirst = first > 12 || second <= 12;
      const date = dayFirst
        ? validDate(year, second, first, endOfToday)
        : validDate(year, first, second, endOfToday);
      if (date) return toISODate(date);

      const swapped = dayFirst ? validDate(year, first, second, endOfToday) : validDate(year, second, first, endOfToday);
      if (swapped) return toISODate(swapped);
    }
  }

  return null;
}

/** Saudi VAT registration numbers are 15 digits that begin and end with 3. */
export function extractVatNumber(lines: string[]): string | null {
  for (const raw of lines) {
    const match = /(?<!\d)(3\d{13}3)(?!\d)/.exec(normalizeDigits(raw));
    if (match) return match[1]!;
  }
  return null;
}

const MERCHANT_NOISE = [
  'فاتورة', 'ضريبية', 'الرقم الضريبي', 'رقم الضريبي', 'سجل تجاري', 'الرقم المرجعي',
  'invoice', 'tax', 'vat', 'receipt', 'simplified', 'no.', 'tel', 'هاتف', 'جوال',
  'الرياض', 'جدة', 'الدمام', 'طريق', 'شارع', 'ص.ب',
];

/**
 * The shop name is normally the first substantial line at the top. Lines that
 * are mostly digits, or that carry invoice boilerplate, are skipped.
 */
export function extractMerchant(lines: string[]): string | null {
  for (const raw of lines.slice(0, 6)) {
    const line = raw.trim();
    if (line.length < 3 || line.length > 60) continue;

    const lowered = normalizeDigits(line).toLowerCase();
    if (MERCHANT_NOISE.some((noise) => lowered.includes(noise))) continue;

    const letters = (line.match(/[\p{L}]/gu) ?? []).length;
    if (letters < 3 || letters / line.length < 0.5) continue;

    return line.replace(/\s{2,}/g, ' ');
  }

  return null;
}

export function parseReceiptText(text: string, today: Date = new Date()): ParsedReceipt {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return {
    merchant: extractMerchant(lines),
    totalMinor: extractTotalMinor(lines),
    purchaseDate: extractPurchaseDate(lines, today),
    vatNumber: extractVatNumber(lines),
  };
}
