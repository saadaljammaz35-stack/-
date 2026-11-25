/**
 * Minimal 5-field cron (minute hour day-of-month month day-of-week) evaluated in an
 * IANA time zone. Supports `*`, lists `a,b`, ranges `a-b`, steps `*\/n` and `a-b/n`.
 * Day-of-week: 0 or 7 = Sunday.
 */

type Field = Set<number>;

function parseField(spec: string, min: number, max: number): Field {
  const out = new Set<number>();
  for (const part of spec.split(',')) {
    const [range, stepRaw] = part.split('/');
    const step = stepRaw ? Number(stepRaw) : 1;
    if (!Number.isInteger(step) || step < 1) throw new Error(`invalid cron step: ${part}`);
    let lo = min;
    let hi = max;
    if (range !== '*') {
      const [a, b] = range!.split('-');
      lo = Number(a);
      hi = b === undefined ? (stepRaw ? max : lo) : Number(b);
    }
    if (!Number.isInteger(lo) || !Number.isInteger(hi) || lo < min || hi > max || lo > hi) throw new Error(`invalid cron field: ${part}`);
    for (let v = lo; v <= hi; v += step) out.add(v);
  }
  return out;
}

export interface Cron {
  minute: Field;
  hour: Field;
  dom: Field;
  month: Field;
  dow: Field;
  domAny: boolean;
  dowAny: boolean;
}

export function parseCron(expr: string): Cron {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) throw new Error('cron must have 5 fields');
  const [mi, h, dom, mo, dw] = parts as [string, string, string, string, string];
  const dow = parseField(dw, 0, 7);
  if (dow.has(7)) dow.add(0);
  return {
    minute: parseField(mi, 0, 59),
    hour: parseField(h, 0, 23),
    dom: parseField(dom, 1, 31),
    month: parseField(mo, 1, 12),
    dow,
    domAny: dom === '*',
    dowAny: dw === '*',
  };
}

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function localParts(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', weekday: 'short',
  });
  const p = Object.fromEntries(fmt.formatToParts(date).map((x) => [x.type, x.value]));
  return { month: Number(p.month), day: Number(p.day), hour: Number(p.hour), minute: Number(p.minute), dow: WEEKDAYS[p.weekday!] ?? 0 };
}

export function matches(c: Cron, date: Date, timeZone: string): boolean {
  const t = localParts(date, timeZone);
  if (!c.minute.has(t.minute) || !c.hour.has(t.hour) || !c.month.has(t.month)) return false;
  // Standard cron: when both day fields are restricted, either may match.
  if (c.domAny && c.dowAny) return true;
  if (c.domAny) return c.dow.has(t.dow);
  if (c.dowAny) return c.dom.has(t.day);
  return c.dom.has(t.day) || c.dow.has(t.dow);
}

/** The first matching minute strictly after `after`. Searches up to 400 days. */
export function nextRun(expr: string, after: Date, timeZone = 'Asia/Riyadh'): Date {
  const c = parseCron(expr);
  const t = new Date(Math.floor(after.getTime() / 60_000) * 60_000 + 60_000);
  const limit = after.getTime() + 400 * 86_400_000;
  while (t.getTime() < limit) {
    const parts = localParts(t, timeZone);
    if (!c.hour.has(parts.hour)) {
      t.setTime(t.getTime() + (60 - parts.minute) * 60_000);
      continue;
    }
    if (matches(c, t, timeZone)) return new Date(t);
    t.setTime(t.getTime() + 60_000);
  }
  throw new Error(`cron never fires: ${expr}`);
}
