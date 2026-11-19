export type Locale = 'ar' | 'en';

/** Halalas (integer) → "28.50 ر.س" / "SAR 28.50". Western digits are used in both languages. */
export function formatMoney(halalas: number, locale: Locale): string {
  const value = (halalas / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return locale === 'ar' ? `${value} ر.س` : `SAR ${value}`;
}

export function toHalalas(sar: string | number): number {
  const n = typeof sar === 'number' ? sar : Number(String(sar).replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(n) || n < 0) throw new Error('invalid amount');
  return Math.round(n * 100);
}

export function fromHalalas(halalas: number | null | undefined): string {
  if (halalas == null) return '';
  return (halalas / 100).toFixed(2);
}
