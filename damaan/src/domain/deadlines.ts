import { addDays, addMonths, daysBetween, fromISODate, startOfDay } from './dates';
import type { Receipt } from './receipt';
import type { SymbolProps } from '../ui/Symbol';

export type DeadlineKind = 'exchange' | 'return' | 'warranty';

export type DeadlineState =
  /** The window is closed. */
  | 'expired'
  /** Days away — act now. */
  | 'critical'
  /** Weeks away — worth a heads-up. */
  | 'soon'
  /** Plenty of time. */
  | 'active'
  /** This receipt has no such window (e.g. no warranty). */
  | 'notApplicable';

export type Deadline = {
  kind: DeadlineKind;
  label: string;
  symbol: SymbolProps['name'];
  endsOn: Date | null;
  /** Whole days remaining. Negative once the window has closed. */
  daysLeft: number;
  state: DeadlineState;
  /** How much of the window has elapsed, 0…1, for the progress track. */
  progress: number;
};

/**
 * How close is close enough to warn. Refund and exchange windows are short, so
 * a couple of days is already critical; a warranty is long, so a month out
 * still deserves a nudge — that is when you can still get it serviced calmly.
 */
const THRESHOLDS: Record<DeadlineKind, { critical: number; soon: number }> = {
  exchange: { critical: 2, soon: 4 },
  return: { critical: 3, soon: 7 },
  warranty: { critical: 7, soon: 30 },
};

const META: Record<DeadlineKind, { label: string; symbol: SymbolProps['name'] }> = {
  exchange: { label: 'الاستبدال', symbol: 'arrow.triangle.2.circlepath' },
  return: { label: 'الاسترجاع', symbol: 'arrow.uturn.backward' },
  warranty: { label: 'الضمان', symbol: 'checkmark.shield' },
};

function buildDeadline(
  kind: DeadlineKind,
  purchase: Date,
  endsOn: Date | null,
  now: Date,
): Deadline {
  const meta = META[kind];

  if (!endsOn) {
    return { kind, ...meta, endsOn: null, daysLeft: 0, state: 'notApplicable', progress: 0 };
  }

  const daysLeft = daysBetween(now, endsOn);
  const windowLength = Math.max(1, daysBetween(purchase, endsOn));
  const elapsed = windowLength - Math.max(0, daysLeft);
  const { critical, soon } = THRESHOLDS[kind];

  const state: DeadlineState =
    daysLeft < 0 ? 'expired' : daysLeft <= critical ? 'critical' : daysLeft <= soon ? 'soon' : 'active';

  return { kind, ...meta, endsOn, daysLeft, state, progress: elapsed / windowLength };
}

/** The three windows on a receipt, soonest first. */
export function deadlinesFor(receipt: Receipt, now: Date = new Date()): Deadline[] {
  const purchase = fromISODate(receipt.purchaseDate);
  const today = startOfDay(now);

  return [
    buildDeadline('exchange', purchase, receipt.exchangeDays > 0 ? addDays(purchase, receipt.exchangeDays) : null, today),
    buildDeadline('return', purchase, receipt.returnDays > 0 ? addDays(purchase, receipt.returnDays) : null, today),
    buildDeadline(
      'warranty',
      purchase,
      receipt.warrantyMonths > 0 ? addMonths(purchase, receipt.warrantyMonths) : null,
      today,
    ),
  ];
}

/**
 * The one window worth showing on a list row: the nearest one still open,
 * falling back to the warranty so an expired receipt still reads sensibly.
 */
export function headlineDeadline(receipt: Receipt, now: Date = new Date()): Deadline {
  const all = deadlinesFor(receipt, now);
  const open = all
    .filter((deadline) => deadline.state !== 'expired' && deadline.state !== 'notApplicable')
    .sort((a, b) => a.daysLeft - b.daysLeft);

  return open[0] ?? all[all.length - 1]!;
}

export type ReceiptState = 'needsAttention' | 'protected' | 'expired';

/** Which home-screen section a receipt belongs in. */
export function receiptState(receipt: Receipt, now: Date = new Date()): ReceiptState {
  const all = deadlinesFor(receipt, now);
  if (all.some((deadline) => deadline.state === 'critical' || deadline.state === 'soon')) {
    return 'needsAttention';
  }
  if (all.some((deadline) => deadline.state === 'active')) return 'protected';
  return 'expired';
}

/** Maps a state onto the palette so colour stays consistent everywhere. */
export function deadlineColor(
  state: DeadlineState,
  colors: { red: string; orange: string; green: string; gray: string },
): string {
  switch (state) {
    case 'critical':
      return colors.red;
    case 'soon':
      return colors.orange;
    case 'active':
      return colors.green;
    default:
      return colors.gray;
  }
}

/** `باقي ٣ أيام` / `انتهى قبل يومين` / `ينتهي اليوم`. */
export function describeDeadline(deadline: Deadline, countDays: (days: number) => string): string {
  if (deadline.state === 'notApplicable') return 'غير مشمول';
  if (deadline.daysLeft === 0) return 'ينتهي اليوم';
  if (deadline.daysLeft < 0) return `انتهى قبل ${countDays(-deadline.daysLeft)}`;
  return `باقي ${countDays(deadline.daysLeft)}`;
}
