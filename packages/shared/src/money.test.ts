import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Money, divideRound } from './money.js';
import { CurrencyMismatchError, InvalidAmountError } from './errors.js';

describe('Money — construction from major units', () => {
  it('parses the NABD demo balance exactly', () => {
    const m = Money.fromMajor('12,850.75', 'SAR');
    assert.equal(m.minor, 1285075n);
    assert.equal(m.toMajorString(), '12850.75');
    assert.equal(m.format('en'), '12,850.75 SAR');
  });

  it('parses values that binary floating point cannot represent', () => {
    // 0.1 + 0.2 !== 0.3 in IEEE-754. In minor units it is simply 10 + 20 = 30.
    const a = Money.fromMajor('0.10', 'SAR');
    const b = Money.fromMajor('0.20', 'SAR');
    assert.equal(a.add(b).minor, 30n);
    assert.equal(a.add(b).toMajorString(), '0.30');
  });

  it('handles the classic 1.005 rounding trap', () => {
    // Number(1.005).toFixed(2) === "1.00" because 1.005 is stored as 1.00499…
    // Integer minor units have no such error.
    assert.equal(Money.fromMajor('1.005', 'KWD').minor, 1005n);
  });

  it('respects currency exponent', () => {
    assert.equal(Money.fromMajor('100', 'JPY').minor, 100n); // exponent 0
    assert.equal(Money.fromMajor('100', 'SAR').minor, 10000n); // exponent 2
    assert.equal(Money.fromMajor('100', 'KWD').minor, 100000n); // exponent 3
  });

  it('rejects more precision than the currency has, rather than rounding it away', () => {
    assert.throws(() => Money.fromMajor('1.999', 'SAR'), InvalidAmountError);
    assert.throws(() => Money.fromMajor('1.5', 'JPY'), InvalidAmountError);
  });

  it('accepts fewer decimals than the exponent', () => {
    assert.equal(Money.fromMajor('1.5', 'SAR').minor, 150n);
    assert.equal(Money.fromMajor('1', 'SAR').minor, 100n);
    assert.equal(Money.fromMajor('.5', 'SAR').minor, 50n);
  });

  it('parses negatives and Arabic-Indic thousands separators', () => {
    assert.equal(Money.fromMajor('-1,000.25', 'SAR').minor, -100025n);
    assert.equal(Money.fromMajor('1٬000.25', 'SAR').minor, 100025n);
  });

  it('rejects malformed input instead of coercing it', () => {
    const bad = [
      '',
      'abc',
      '1.2.3',
      '--1',
      '1,,', // separators must not be blindly stripped
      '1,00.25', // wrong grouping width
      '12,34,567', // wrong grouping width
      '1.', // trailing separator with no fraction
      ',',
      'NaN',
      '1e5',
      '0x10',
      '1-0',
    ];
    for (const value of bad) {
      assert.throws(
        () => Money.fromMajor(value, 'SAR'),
        InvalidAmountError,
        `expected reject: "${value}"`,
      );
    }
  });

  it('accepts well-formed grouped and ungrouped input', () => {
    assert.equal(Money.fromMajor('1234567.89', 'SAR').minor, 123456789n);
    assert.equal(Money.fromMajor('1,234,567.89', 'SAR').minor, 123456789n);
    assert.equal(Money.fromMajor('999', 'SAR').minor, 99900n);
  });

  it('rejects unsafe integers passed as minor units', () => {
    assert.throws(
      () => Money.fromMinor(Number.MAX_SAFE_INTEGER + 2, 'SAR'),
      InvalidAmountError,
    );
  });

  it('handles amounts far beyond Number.MAX_SAFE_INTEGER', () => {
    const huge = Money.fromMinor('9007199254740993000', 'SAR');
    assert.equal(huge.add(Money.fromMinor(1n, 'SAR')).minor, 9007199254740993001n);
  });
});

describe('Money — arithmetic', () => {
  it('adds and subtracts', () => {
    const a = Money.fromMajor('100.00', 'SAR');
    const b = Money.fromMajor('25.50', 'SAR');
    assert.equal(a.add(b).toMajorString(), '125.50');
    assert.equal(a.subtract(b).toMajorString(), '74.50');
  });

  it('refuses to mix currencies', () => {
    const sar = Money.fromMajor('100', 'SAR');
    const usd = Money.fromMajor('100', 'USD');
    assert.throws(() => sar.add(usd), CurrencyMismatchError);
    assert.throws(() => sar.subtract(usd), CurrencyMismatchError);
    assert.throws(() => sar.compare(usd), CurrencyMismatchError);
  });

  it('is immutable', () => {
    const a = Money.fromMajor('100', 'SAR');
    a.add(Money.fromMajor('50', 'SAR'));
    assert.equal(a.toMajorString(), '100.00', 'original must not change');
    assert.equal(Object.isFrozen(a), true);
  });

  it('applies a rate as an exact fraction', () => {
    // 1.5% fee on 1,000.00 SAR = 15.00 SAR
    const fee = Money.fromMajor('1000.00', 'SAR').applyRate(15n, 1000n, 'HALF_UP');
    assert.equal(fee.toMajorString(), '15.00');
  });

  it("uses banker's rounding by default for rates", () => {
    // 0.005 SAR ties: HALF_EVEN sends 2.5→2 and 3.5→4 minor units.
    assert.equal(Money.fromMinor(5n, 'SAR').applyRate(1n, 2n).minor, 2n);
    assert.equal(Money.fromMinor(7n, 'SAR').applyRate(1n, 2n).minor, 4n);
  });

  it('converts across currencies with differing exponents', () => {
    // 100.00 SAR at 0.2666 SAR→USD
    const usd = Money.fromMajor('100.00', 'SAR').convert('USD', 2666n, 10000n, 'HALF_UP');
    assert.equal(usd.currency, 'USD');
    assert.equal(usd.toMajorString(), '26.66');

    // SAR (exp 2) → JPY (exp 0) must not inherit the source scale.
    const jpy = Money.fromMajor('100.00', 'SAR').convert('JPY', 40n, 1n, 'HALF_UP');
    assert.equal(jpy.toMajorString(), '4000');
  });
});

describe('Money — splitting conserves the total', () => {
  it('splits 100.00 SAR three ways without losing a halala', () => {
    const parts = Money.fromMajor('100.00', 'SAR').split(3);
    assert.deepEqual(
      parts.map((p) => p.toMajorString()),
      ['33.34', '33.33', '33.33'],
    );
    assert.equal(Money.sum(parts).toMajorString(), '100.00');
  });

  it('conserves the total for every split count from 1 to 50', () => {
    const total = Money.fromMinor(1000003n, 'SAR');
    for (let n = 1; n <= 50; n += 1) {
      const parts = total.split(n);
      assert.equal(parts.length, n);
      assert.equal(Money.sum(parts).minor, total.minor, `split(${n}) lost money`);
    }
  });

  it('conserves the total for negative amounts', () => {
    const total = Money.fromMinor(-1000003n, 'SAR');
    const parts = total.split(7);
    assert.equal(Money.sum(parts).minor, total.minor);
  });

  it('allocates by weight and conserves the total', () => {
    // Split a 10.00 SAR fee 70/20/10.
    const parts = Money.fromMajor('10.00', 'SAR').allocate([70, 20, 10]);
    assert.deepEqual(
      parts.map((p) => p.toMajorString()),
      ['7.00', '2.00', '1.00'],
    );
    assert.equal(Money.sum(parts).toMajorString(), '10.00');
  });

  it('allocates an indivisible remainder to the largest weights', () => {
    const parts = Money.fromMinor(100n, 'SAR').allocate([1, 1, 1]);
    assert.equal(Money.sum(parts).minor, 100n);
    assert.deepEqual(
      parts.map((p) => p.minor),
      [34n, 33n, 33n],
    );
  });

  it('never gives a remainder unit to a zero weight', () => {
    const parts = Money.fromMinor(10n, 'SAR').allocate([3, 0]);
    assert.equal(parts[1]?.minor, 0n);
    assert.equal(Money.sum(parts).minor, 10n);
  });

  it('rejects nonsense allocations', () => {
    const m = Money.fromMajor('10', 'SAR');
    assert.throws(() => m.split(0), InvalidAmountError);
    assert.throws(() => m.split(-1), InvalidAmountError);
    assert.throws(() => m.allocate([]), InvalidAmountError);
    assert.throws(() => m.allocate([0, 0]), InvalidAmountError);
    assert.throws(() => m.allocate([-1, 2]), InvalidAmountError);
  });
});

describe('divideRound — every mode', () => {
  const cases: Array<[bigint, bigint, Parameters<typeof divideRound>[2], bigint]> = [
    // 5/2 = 2.5 exactly on the tie
    [5n, 2n, 'DOWN', 2n],
    [5n, 2n, 'UP', 3n],
    [5n, 2n, 'CEILING', 3n],
    [5n, 2n, 'FLOOR', 2n],
    [5n, 2n, 'HALF_UP', 3n],
    [5n, 2n, 'HALF_DOWN', 2n],
    [5n, 2n, 'HALF_EVEN', 2n],
    // -5/2 = -2.5
    [-5n, 2n, 'DOWN', -2n],
    [-5n, 2n, 'UP', -3n],
    [-5n, 2n, 'CEILING', -2n],
    [-5n, 2n, 'FLOOR', -3n],
    [-5n, 2n, 'HALF_UP', -3n],
    [-5n, 2n, 'HALF_DOWN', -2n],
    [-5n, 2n, 'HALF_EVEN', -2n],
    // 7/2 = 3.5 — HALF_EVEN goes to 4 (even), not 3
    [7n, 2n, 'HALF_EVEN', 4n],
    // exact division is untouched by mode
    [10n, 5n, 'HALF_EVEN', 2n],
    [-10n, 5n, 'UP', -2n],
  ];

  for (const [n, d, mode, expected] of cases) {
    it(`${n}/${d} ${mode} = ${expected}`, () => {
      assert.equal(divideRound(n, d, mode), expected);
    });
  }

  it('normalises a negative denominator', () => {
    assert.equal(divideRound(5n, -2n, 'FLOOR'), -3n);
  });

  it('rejects division by zero', () => {
    assert.throws(() => divideRound(1n, 0n, 'HALF_UP'), InvalidAmountError);
  });
});

describe('Money — comparison and presentation', () => {
  it('compares', () => {
    const a = Money.fromMajor('10', 'SAR');
    const b = Money.fromMajor('20', 'SAR');
    assert.equal(a.lessThan(b), true);
    assert.equal(b.greaterThan(a), true);
    assert.equal(a.greaterThanOrEqual(a), true);
    assert.equal(a.equals(Money.fromMajor('10.00', 'SAR')), true);
    assert.equal(
      a.equals(Money.fromMajor('10', 'USD')),
      false,
      'currency is part of identity',
    );
  });

  it('reports sign', () => {
    assert.equal(Money.zero('SAR').isZero, true);
    assert.equal(Money.fromMinor(-1n, 'SAR').isNegative, true);
    assert.equal(Money.fromMinor(1n, 'SAR').isPositive, true);
  });

  it('formats with grouping', () => {
    assert.equal(Money.fromMajor('1234567.89', 'SAR').format('en'), '1,234,567.89 SAR');
    assert.equal(
      Money.fromMajor('1234567.89', 'SAR').format('en', { showCode: false }),
      '1,234,567.89',
    );
    assert.equal(Money.fromMajor('-50.00', 'USD').format('en'), '-50.00 USD');
    assert.equal(Money.fromMajor('1000', 'JPY').format('en'), '1,000 JPY');
  });

  it('round-trips through JSON without precision loss', () => {
    const original = Money.fromMinor('123456789012345678', 'SAR');
    const json = JSON.parse(JSON.stringify(original)) as {
      amount: string;
      currency: 'SAR';
    };
    const restored = Money.fromMinor(json.amount, json.currency);
    assert.equal(restored.minor, original.minor);
  });

  it('sums a list and rejects a mixed-currency list', () => {
    const list = [Money.fromMajor('1', 'SAR'), Money.fromMajor('2', 'SAR')];
    assert.equal(Money.sum(list).toMajorString(), '3.00');
    assert.equal(Money.sum([], 'SAR').isZero, true);
    assert.throws(() => Money.sum([]), InvalidAmountError);
    assert.throws(
      () => Money.sum([Money.fromMajor('1', 'SAR'), Money.fromMajor('1', 'USD')]),
      CurrencyMismatchError,
    );
  });
});
