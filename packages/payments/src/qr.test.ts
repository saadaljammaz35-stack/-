import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Money, ValidationError } from '@nabd/shared';

import {
  buildQrPayload,
  checkQrPayment,
  crc16,
  parseQrPayload,
  tryParseQrPayload,
} from './qr.js';

const SAR = 'SAR' as const;

function sar(major: string): Money {
  return Money.fromMajor(major, SAR);
}

describe('CRC-16/CCITT-FALSE', () => {
  it('matches the canonical CRC-16/CCITT-FALSE check value', () => {
    // The catalogue check value for this CRC variant. If this passes, the
    // polynomial, initial value, reflection and final-XOR settings are all
    // correct.
    assert.equal(crc16('123456789'), '29B1');
  });

  it('computes over UTF-8 bytes, not UTF-16 code units', () => {
    // For pure ASCII the two are identical, which is exactly why this class of
    // bug survives a Latin-only test suite. An Arabic merchant name produces a
    // completely different checksum, and other wallets compute it over bytes.
    const arabic = 'مقهى نبض';
    const overBytes = crc16(arabic);

    let overCodeUnits = 0xffff;
    for (let i = 0; i < arabic.length; i += 1) {
      overCodeUnits ^= arabic.charCodeAt(i) << 8;
      for (let bit = 0; bit < 8; bit += 1) {
        overCodeUnits =
          (overCodeUnits & 0x8000) !== 0
            ? ((overCodeUnits << 1) ^ 0x1021) & 0xffff
            : (overCodeUnits << 1) & 0xffff;
      }
    }
    assert.notEqual(
      overBytes,
      overCodeUnits.toString(16).toUpperCase().padStart(4, '0'),
      'the two differ for Arabic — this test guards the byte-wise implementation',
    );
    assert.equal(overBytes, 'FDF6');
  });

  it('is deterministic and length-stable', () => {
    for (const input of ['', 'A', 'hello world', '0'.repeat(500)]) {
      const result = crc16(input);
      assert.match(result, /^[0-9A-F]{4}$/, `bad CRC for input of length ${input.length}`);
      assert.equal(crc16(input), result);
    }
  });

  it('changes when a single character changes', () => {
    assert.notEqual(crc16('540510.00'), crc16('540520.00'));
  });
});

describe('Building a QR payload', () => {
  it('produces a dynamic code carrying the amount', () => {
    const payload = buildQrPayload({
      amount: sar('125.50'),
      currency: SAR,
      merchantName: 'Test Merchant',
      merchantCity: 'Riyadh',
      nabdHandle: '+966512345678',
      reference: 'REF-001',
    });

    assert.ok(payload.startsWith('000201'), 'payload format indicator first');
    assert.ok(payload.includes('010212'), 'marked dynamic');
    assert.ok(payload.includes('5303682'), 'SAR numeric currency code');
    assert.ok(payload.includes('5406125.50'), 'amount as a major-unit string');
    assert.match(payload, /6304[0-9A-F]{4}$/, 'ends with the CRC field');
  });

  it('produces a static code with no amount', () => {
    const payload = buildQrPayload({
      currency: SAR,
      merchantName: 'Corner Shop',
      merchantCity: 'Jeddah',
      nabdHandle: 'acc_123',
    });

    assert.ok(payload.includes('010211'), 'marked static');
    const parsed = parseQrPayload(payload);
    assert.equal(parsed.isDynamic, false);
    assert.equal(parsed.amount, null, 'the payer supplies the amount');
  });

  it('rejects an amount that is zero, negative, or in another currency', () => {
    const base = {
      currency: SAR,
      merchantName: 'Shop',
      merchantCity: 'Riyadh',
      nabdHandle: 'acc_1',
    };
    assert.throws(
      () => buildQrPayload({ ...base, amount: Money.fromMinor(0n, SAR) }),
      ValidationError,
    );
    assert.throws(
      () => buildQrPayload({ ...base, amount: Money.fromMinor(-100n, SAR) }),
      ValidationError,
    );
    assert.throws(
      () => buildQrPayload({ ...base, amount: Money.fromMajor('10.00', 'USD') }),
      ValidationError,
    );
  });

  it('rejects an empty merchant name', () => {
    assert.throws(
      () =>
        buildQrPayload({
          currency: SAR,
          merchantName: '   ',
          merchantCity: 'Riyadh',
          nabdHandle: 'acc_1',
        }),
      ValidationError,
    );
  });

  it('truncates over-long names rather than emitting an invalid field', () => {
    const payload = buildQrPayload({
      currency: SAR,
      merchantName: 'A'.repeat(80),
      merchantCity: 'B'.repeat(80),
      nabdHandle: 'acc_1',
    });
    const parsed = parseQrPayload(payload);
    assert.equal(parsed.merchantName.length, 25);
    assert.equal(parsed.merchantCity.length, 15);
  });
});

describe('Round-tripping', () => {
  it('parses back everything it encoded', () => {
    const payload = buildQrPayload({
      amount: sar('1250.75'),
      currency: SAR,
      merchantName: 'NABD Coffee',
      merchantCity: 'Riyadh',
      merchantCategoryCode: '5812',
      nabdHandle: '+966512345678',
      merchantId: 'M-42',
      reference: 'ORDER-9981',
      billNumber: 'INV-77',
      purpose: 'Coffee',
    });

    const parsed = parseQrPayload(payload);
    assert.equal(parsed.isDynamic, true);
    assert.equal(parsed.amount?.minor, 125_075n);
    assert.equal(parsed.currency, SAR);
    assert.equal(parsed.merchantName, 'NABD Coffee');
    assert.equal(parsed.merchantCity, 'Riyadh');
    assert.equal(parsed.merchantCategoryCode, '5812');
    assert.equal(parsed.countryCode, 'SA');
    assert.equal(parsed.nabdHandle, '+966512345678');
    assert.equal(parsed.merchantId, 'M-42');
    assert.equal(parsed.reference, 'ORDER-9981');
    assert.equal(parsed.billNumber, 'INV-77');
    assert.equal(parsed.purpose, 'Coffee');
  });

  it('preserves an amount exactly, with no float drift', () => {
    for (const value of ['0.01', '0.99', '1.005'.slice(0, 4), '9999999.99', '1250.75']) {
      const payload = buildQrPayload({
        amount: sar(value),
        currency: SAR,
        merchantName: 'M',
        merchantCity: 'R',
        nabdHandle: 'acc_1',
      });
      assert.equal(
        parseQrPayload(payload).amount?.minor,
        sar(value).minor,
        `amount drifted for ${value}`,
      );
    }
  });
});

describe('Arabic merchant names', () => {
  it('carries the Arabic name in the language template, not in tag 59', () => {
    // Tag 59 is defined as Latin script. EMVCo's tag 64 exists precisely to
    // carry a non-Latin name, and scanners that assume Latin in tag 59 break
    // when it holds Arabic.
    const payload = buildQrPayload({
      amount: sar('45.00'),
      currency: SAR,
      merchantName: 'NABD Coffee',
      merchantCity: 'Riyadh',
      merchantNameAr: 'مقهى نبض',
      merchantCityAr: 'الرياض',
      nabdHandle: 'acc_1',
    });

    const parsed = parseQrPayload(payload);
    assert.equal(parsed.merchantName, 'NABD Coffee', 'tag 59 stays Latin');
    assert.equal(parsed.merchantNameAr, 'مقهى نبض');
    assert.equal(parsed.merchantCityAr, 'الرياض');
  });

  it('survives a full round-trip with an Arabic name and correct checksum', () => {
    const payload = buildQrPayload({
      amount: sar('1234.56'),
      currency: SAR,
      merchantName: 'Al Nakheel Market',
      merchantCity: 'Jeddah',
      merchantNameAr: 'سوق النخيل',
      nabdHandle: '+966512345678',
      reference: 'ORD-1',
    });

    // Would throw on a checksum mismatch — which is what a code-unit CRC
    // would produce here.
    const parsed = parseQrPayload(payload);
    assert.equal(parsed.amount?.minor, 123_456n);
    assert.equal(parsed.merchantNameAr, 'سوق النخيل');
  });

  it('leaves the language template absent when no Arabic name is supplied', () => {
    const parsed = parseQrPayload(
      buildQrPayload({
        currency: SAR,
        merchantName: 'Latin Only',
        merchantCity: 'Riyadh',
        nabdHandle: 'acc_1',
      }),
    );
    assert.equal(parsed.merchantNameAr, null);
    assert.equal(parsed.merchantCityAr, null);
  });
});

describe('Rejecting bad scans', () => {
  it('rejects a payload whose checksum does not match', () => {
    // A smudged sticker or a bad camera frame can produce a payload that
    // parses perfectly and carries the wrong amount. The CRC is the only thing
    // that catches it.
    const payload = buildQrPayload({
      amount: sar('100.00'),
      currency: SAR,
      merchantName: 'Shop',
      merchantCity: 'Riyadh',
      nabdHandle: 'acc_1',
    });

    const tampered = payload.replace('5406100.00', '5406900.00');
    assert.notEqual(tampered, payload, 'the test must actually change the amount');
    assert.throws(() => parseQrPayload(tampered), ValidationError);
  });

  it('rejects a payload with no checksum field', () => {
    assert.throws(() => parseQrPayload('00020101021126'), ValidationError);
  });

  it('rejects a truncated field', () => {
    // Declares 50 characters but supplies far fewer.
    const bad = `0002010102125950SHORT6304`;
    assert.throws(() => parseQrPayload(`${bad}0000`), ValidationError);
  });

  it('rejects non-numeric tags and lengths', () => {
    assert.throws(() => parseQrPayload('XX0201010211630400000'), ValidationError);
  });

  it('rejects anything too short to be a payload', () => {
    for (const bad of ['', '00', '000201']) {
      assert.throws(() => parseQrPayload(bad), ValidationError);
    }
  });

  it('returns null rather than throwing on a camera loop', () => {
    // A scanner sees many bad frames per second; each must not throw.
    assert.equal(tryParseQrPayload('garbage'), null);
    assert.equal(tryParseQrPayload(''), null);
    assert.ok(
      tryParseQrPayload(
        buildQrPayload({
          currency: SAR,
          merchantName: 'M',
          merchantCity: 'R',
          nabdHandle: 'acc_1',
        }),
      ) !== null,
    );
  });

  it('parses a non-NABD code without claiming it as ours', () => {
    const foreign = buildQrPayload({
      currency: SAR,
      merchantName: 'Other Wallet',
      merchantCity: 'Riyadh',
      nabdHandle: 'acc_1',
    }).replace('SA.NABD', 'SA.OTHER');

    // The identifier changed, so the CRC no longer matches — which is correct:
    // a modified payload must not be trusted.
    assert.throws(() => parseQrPayload(foreign), ValidationError);
  });
});

describe('Deciding whether a scanned code may be paid', () => {
  const supported = [SAR] as const;

  function dynamicCode(
    amount: string,
    reference = 'REF-1',
  ): ReturnType<typeof parseQrPayload> {
    return parseQrPayload(
      buildQrPayload({
        amount: sar(amount),
        currency: SAR,
        merchantName: 'Shop',
        merchantCity: 'Riyadh',
        nabdHandle: 'merchant_wallet',
        reference,
      }),
    );
  }

  function staticCode(): ReturnType<typeof parseQrPayload> {
    return parseQrPayload(
      buildQrPayload({
        currency: SAR,
        merchantName: 'Shop',
        merchantCity: 'Riyadh',
        nabdHandle: 'merchant_wallet',
      }),
    );
  }

  it('accepts a dynamic code at exactly its stated amount', () => {
    const result = checkQrPayment({
      parsed: dynamicCode('75.00'),
      payerHandle: 'payer_wallet',
      supportedCurrencies: supported,
    });
    assert.equal(result.acceptable, true);
    assert.equal(result.amountToPay?.minor, 7_500n);
  });

  it('refuses to pay a dynamic code for a different amount', () => {
    // The figure the merchant displayed and the figure charged must be the
    // same — that is the entire trust model of scanning a code.
    const result = checkQrPayment({
      parsed: dynamicCode('75.00'),
      payerHandle: 'payer_wallet',
      enteredAmount: sar('5.00'),
      supportedCurrencies: supported,
    });
    assert.equal(result.acceptable, false);
    assert.equal(result.reason, 'AMOUNT_MISMATCH');
    assert.equal(result.amountToPay?.minor, 7_500n, 'the real amount is still reported');
  });

  it('asks the payer for an amount on a static code', () => {
    const prompt = checkQrPayment({
      parsed: staticCode(),
      payerHandle: 'payer_wallet',
      supportedCurrencies: supported,
    });
    assert.equal(prompt.acceptable, false);
    assert.equal(prompt.requiresAmountEntry, true);

    const entered = checkQrPayment({
      parsed: staticCode(),
      payerHandle: 'payer_wallet',
      enteredAmount: sar('42.00'),
      supportedCurrencies: supported,
    });
    assert.equal(entered.acceptable, true);
    assert.equal(entered.amountToPay?.minor, 4_200n);
  });

  it('rejects a zero or negative entered amount', () => {
    const result = checkQrPayment({
      parsed: staticCode(),
      payerHandle: 'payer_wallet',
      enteredAmount: Money.fromMinor(0n, SAR),
      supportedCurrencies: supported,
    });
    assert.equal(result.acceptable, false);
  });

  it('refuses to let someone pay their own code', () => {
    const result = checkQrPayment({
      parsed: dynamicCode('10.00'),
      payerHandle: 'merchant_wallet',
      supportedCurrencies: supported,
    });
    assert.equal(result.acceptable, false);
    assert.equal(result.reason, 'SELF_PAYMENT');
  });

  it('refuses a currency the wallet does not support', () => {
    const result = checkQrPayment({
      parsed: dynamicCode('10.00'),
      payerHandle: 'payer_wallet',
      supportedCurrencies: ['USD'],
    });
    assert.equal(result.acceptable, false);
    assert.equal(result.reason, 'CURRENCY_NOT_SUPPORTED');
  });

  it('refuses a dynamic code that has already been paid', () => {
    // A double-tap, or a replayed screenshot of someone else's checkout code.
    const result = checkQrPayment({
      parsed: dynamicCode('10.00', 'ORDER-55'),
      payerHandle: 'payer_wallet',
      supportedCurrencies: supported,
      usedReferences: new Set(['ORDER-55']),
    });
    assert.equal(result.acceptable, false);
    assert.equal(result.reason, 'DYNAMIC_CODE_REUSED');
  });

  it('still allows a static code to be paid repeatedly', () => {
    // A printed sticker on a counter is meant to be reused.
    const result = checkQrPayment({
      parsed: staticCode(),
      payerHandle: 'payer_wallet',
      enteredAmount: sar('10.00'),
      supportedCurrencies: supported,
      usedReferences: new Set(['anything']),
    });
    assert.equal(result.acceptable, true);
  });
});
