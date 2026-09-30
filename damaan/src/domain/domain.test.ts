import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { addMonths, arabicCount, countDays, daysBetween, formatLongDate, fromISODate, humanDuration, toISODate } from './dates';
import { deadlinesFor, describeDeadline, headlineDeadline, receiptState } from './deadlines';
import { formatMoney, formatMoneyRounded, parseAmountToMinor } from './money';
import { DEFAULT_EXCHANGE_DAYS, DEFAULT_RETURN_DAYS, type Receipt } from './receipt';

function receipt(overrides: Partial<Receipt> = {}): Receipt {
  return {
    id: 'rcp_test',
    merchant: 'متجر الاختبار',
    item: 'جوال',
    categoryId: 'phones',
    totalMinor: 400_000,
    purchaseDate: '2026-01-15',
    warrantyMonths: 12,
    returnDays: DEFAULT_RETURN_DAYS,
    exchangeDays: DEFAULT_EXCHANGE_DAYS,
    serial: '',
    notes: '',
    images: [],
    createdAt: '2026-01-15T00:00:00.000Z',
    updatedAt: '2026-01-15T00:00:00.000Z',
    ...overrides,
  };
}

describe('addMonths', () => {
  it('clamps into the target month instead of spilling over', () => {
    assert.equal(toISODate(addMonths(new Date(2026, 0, 31), 1)), '2026-02-28');
    assert.equal(toISODate(addMonths(new Date(2028, 0, 31), 1)), '2028-02-29');
  });

  it('keeps the day when the target month is long enough', () => {
    assert.equal(toISODate(addMonths(new Date(2026, 0, 15), 12)), '2027-01-15');
  });
});

describe('daysBetween', () => {
  it('ignores the time of day', () => {
    const morning = new Date(2026, 2, 1, 7, 30);
    const night = new Date(2026, 2, 3, 23, 59);
    assert.equal(daysBetween(morning, night), 2);
  });

  it('goes negative once the target is in the past', () => {
    assert.equal(daysBetween(new Date(2026, 2, 10), new Date(2026, 2, 3)), -7);
  });
});

describe('arabic counted nouns', () => {
  it('uses the singular, dual, few and many forms', () => {
    assert.equal(countDays(1), 'يوم واحد');
    assert.equal(countDays(2), 'يومين');
    assert.equal(countDays(5), '5 أيام');
    assert.equal(countDays(20), '20 يومًا');
  });

  it('speaks whole years as years', () => {
    assert.equal(humanDuration(0), 'بدون ضمان');
    assert.equal(humanDuration(12), 'سنة واحدة');
    assert.equal(humanDuration(24), 'سنتان');
    assert.equal(humanDuration(18), '18 شهرًا');
  });

  it('falls back to the bare form when no count is shown', () => {
    assert.equal(arabicCount(1, { one: 'مرة', two: 'مرتان', few: 'مرات', many: 'مرة' }), 'مرة');
  });
});

describe('money', () => {
  it('parses what people actually type', () => {
    assert.equal(parseAmountToMinor('1,299.50'), 129_950);
    assert.equal(parseAmountToMinor('1299'), 129_900);
    assert.equal(parseAmountToMinor('٤٠٠٠'), 400_000);
    assert.equal(parseAmountToMinor('12٫5'), 1_250);
  });

  it('rejects anything that is not an amount', () => {
    assert.equal(parseAmountToMinor(''), null);
    assert.equal(parseAmountToMinor('abc'), null);
    assert.equal(parseAmountToMinor('-5'), null);
  });

  it('formats with grouped thousands and two decimals', () => {
    assert.equal(formatMoney(129_950), '1,299.50 ر.س');
    assert.equal(formatMoney(5_000, { withSymbol: false }), '50.00');
    assert.equal(formatMoneyRounded(129_950), '1,300 ر.س');
  });
});

describe('deadlines', () => {
  const purchase = '2026-03-01';

  it('derives all three windows from the purchase date', () => {
    const [exchange, refund, warranty] = deadlinesFor(receipt({ purchaseDate: purchase }), new Date(2026, 2, 1));
    assert.equal(toISODate(exchange!.endsOn!), '2026-03-08');
    assert.equal(toISODate(refund!.endsOn!), '2026-03-15');
    assert.equal(toISODate(warranty!.endsOn!), '2027-03-01');
  });

  it('marks a window with no days as not applicable', () => {
    const [, , warranty] = deadlinesFor(receipt({ warrantyMonths: 0 }), new Date(2026, 0, 20));
    assert.equal(warranty!.state, 'notApplicable');
    assert.equal(warranty!.endsOn, null);
  });

  it('escalates from active through soon to critical to expired', () => {
    const subject = receipt({ purchaseDate: purchase, warrantyMonths: 0, exchangeDays: 0 });
    const on = (day: number) => deadlinesFor(subject, new Date(2026, 2, day))[1]!;

    assert.equal(on(2).state, 'active');   // 13 days left
    assert.equal(on(9).state, 'soon');     // 6 days left
    assert.equal(on(13).state, 'critical');// 2 days left
    assert.equal(on(15).state, 'critical');// last day
    assert.equal(on(16).state, 'expired');
  });

  it('never lets progress leave the 0…1 range', () => {
    for (const day of [1, 8, 15, 40]) {
      for (const deadline of deadlinesFor(receipt({ purchaseDate: purchase }), new Date(2026, 2, day))) {
        assert.ok(deadline.progress >= 0 && deadline.progress <= 1, `progress out of range on day ${day}`);
      }
    }
  });

  it('headlines the nearest open window', () => {
    const subject = receipt({ purchaseDate: purchase });
    assert.equal(headlineDeadline(subject, new Date(2026, 2, 2)).kind, 'exchange');
    assert.equal(headlineDeadline(subject, new Date(2026, 2, 10)).kind, 'return');
    assert.equal(headlineDeadline(subject, new Date(2026, 2, 20)).kind, 'warranty');
  });

  it('headlines the warranty once everything has closed', () => {
    const subject = receipt({ purchaseDate: purchase, warrantyMonths: 12 });
    assert.equal(headlineDeadline(subject, new Date(2028, 0, 1)).kind, 'warranty');
  });

  it('sorts receipts into home-screen sections', () => {
    const subject = receipt({ purchaseDate: purchase });
    assert.equal(receiptState(subject, new Date(2026, 2, 6)), 'needsAttention');
    assert.equal(receiptState(subject, new Date(2026, 5, 1)), 'protected');
    assert.equal(receiptState(subject, new Date(2028, 0, 1)), 'expired');
  });

  it('describes a window in words a reader expects', () => {
    const subject = receipt({ purchaseDate: purchase, exchangeDays: 0, warrantyMonths: 0 });
    const refundOn = (day: number) => describeDeadline(deadlinesFor(subject, new Date(2026, 2, day))[1]!, countDays);

    assert.equal(refundOn(14), 'باقي يوم واحد');
    assert.equal(refundOn(15), 'ينتهي اليوم');
    assert.equal(refundOn(17), 'انتهى قبل يومين');
  });
});

describe('ISO round trip', () => {
  it('survives a trip through storage', () => {
    const iso = '2026-07-09';
    assert.equal(toISODate(fromISODate(iso)), iso);
    assert.equal(formatLongDate(fromISODate(iso)), '9 يوليو 2026');
  });
});
