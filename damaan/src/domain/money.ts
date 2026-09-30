/**
 * Money is stored as an integer count of halalas so no amount ever drifts
 * through a float. 100 halalas = 1 Saudi riyal.
 */

export const CURRENCY_SYMBOL = 'ر.س';

/** Parses what a person typed — "1,299.50", "١٢٩٩", "1299" — into halalas. */
export function parseAmountToMinor(input: string): number | null {
  const normalized = input
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[٫,\s]/g, (match) => (match === '٫' ? '.' : ''))
    .trim();

  if (!/^\d*\.?\d*$/.test(normalized) || normalized === '' || normalized === '.') return null;

  const riyals = Number(normalized);
  if (!Number.isFinite(riyals) || riyals < 0) return null;

  return Math.round(riyals * 100);
}

/** `1,299.50 ر.س` — grouped thousands, always two decimals. */
export function formatMoney(minor: number, { withSymbol = true } = {}): string {
  const riyals = Math.abs(minor) / 100;
  const [whole, fraction = '00'] = riyals.toFixed(2).split('.');
  const grouped = (whole ?? '0').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const sign = minor < 0 ? '−' : '';
  return `${sign}${grouped}.${fraction}${withSymbol ? ` ${CURRENCY_SYMBOL}` : ''}`;
}

/** Drops the halalas for headline figures: `1,300 ر.س`. */
export function formatMoneyRounded(minor: number): string {
  const riyals = Math.round(minor / 100);
  const grouped = String(riyals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${grouped} ${CURRENCY_SYMBOL}`;
}
