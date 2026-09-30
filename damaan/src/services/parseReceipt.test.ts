import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  extractMerchant,
  extractPurchaseDate,
  extractTotalMinor,
  extractVatNumber,
  normalizeDigits,
  parseReceiptText,
} from './parseReceipt';

const today = new Date(2026, 8, 30); // 30 September 2026

const jarirReceipt = `
مكتبة جرير
فاتورة ضريبية مبسطة
الرقم الضريبي 300012345678903
التاريخ 15/03/2026
------------------------
iPhone 17 Pro 256GB      3,999.00
حافظة جلد                 149.00
------------------------
المجموع قبل الضريبة      3,607.83
ضريبة القيمة المضافة      540.17
الإجمالي شامل الضريبة    4,148.00
المدفوع نقدًا            4,200.00
الباقي                     52.00
`;

describe('normalizeDigits', () => {
  it('converts Arabic-Indic and Persian digits', () => {
    assert.equal(normalizeDigits('٤١٤٨٫٠٠'), '4148.00');
    assert.equal(normalizeDigits('۱۲۳'), '123');
  });
});

describe('extractTotalMinor', () => {
  const lines = (text: string) => text.split('\n').map((line) => line.trim()).filter(Boolean);

  it('prefers the labelled grand total over the subtotal and the VAT', () => {
    assert.equal(extractTotalMinor(lines(jarirReceipt)), 414_800);
  });

  it('ignores the amount tendered and the change', () => {
    const total = extractTotalMinor(lines('الإجمالي 250.00\nالمدفوع 500.00\nالباقي 250.00'));
    assert.equal(total, 25_000);
  });

  it('reads a total printed on the line after its label', () => {
    assert.equal(extractTotalMinor(['الإجمالي', '1,250.75']), 125_075);
  });

  it('handles an English receipt', () => {
    assert.equal(extractTotalMinor(lines('SUBTOTAL 90.00\nVAT 13.50\nTOTAL 103.50')), 10_350);
  });

  it('falls back to the largest amount when nothing is labelled', () => {
    assert.equal(extractTotalMinor(['بقالة', '12.50', '99.00', '7.25']), 9_900);
  });

  it('does not mistake a long reference number for money', () => {
    assert.equal(extractTotalMinor(['رقم المرجع 1234567890123', 'الإجمالي 45.00']), 4_500);
  });

  it('returns null when there is no number at all', () => {
    assert.equal(extractTotalMinor(['شكرًا لزيارتكم']), null);
  });
});

describe('extractPurchaseDate', () => {
  const lines = (text: string) => text.split('\n').map((line) => line.trim()).filter(Boolean);

  it('reads a day-first date', () => {
    assert.equal(extractPurchaseDate(lines(jarirReceipt), today), '2026-03-15');
  });

  it('reads an ISO date', () => {
    assert.equal(extractPurchaseDate(['Date: 2026-07-04'], today), '2026-07-04');
  });

  it('reads a two-digit year', () => {
    assert.equal(extractPurchaseDate(['التاريخ 09-01-26'], today), '2026-01-09');
  });

  it('falls back to month-first when day-first is impossible', () => {
    // 03/25 cannot be day 3 of month 25, so it must be March the 25th.
    assert.equal(extractPurchaseDate(['03/25/2026'], today), '2026-03-25');
  });

  it('rejects a future date', () => {
    assert.equal(extractPurchaseDate(['15/12/2027'], today), null);
  });

  it('rejects an impossible day', () => {
    assert.equal(extractPurchaseDate(['31/02/2026'], today), null);
  });

  it('accepts today', () => {
    assert.equal(extractPurchaseDate(['30/09/2026'], today), '2026-09-30');
  });

  it('returns null when no date is printed', () => {
    assert.equal(extractPurchaseDate(['الإجمالي 45.00'], today), null);
  });
});

describe('extractVatNumber', () => {
  it('finds a 15-digit registration number', () => {
    assert.equal(extractVatNumber(['الرقم الضريبي 300012345678903']), '300012345678903');
  });

  it('ignores a number of the wrong shape', () => {
    assert.equal(extractVatNumber(['12345', '400012345678901']), null);
  });
});

describe('extractMerchant', () => {
  it('takes the shop name from the top of the receipt', () => {
    assert.equal(extractMerchant(jarirReceipt.split('\n').map((line) => line.trim()).filter(Boolean)), 'مكتبة جرير');
  });

  it('skips invoice boilerplate and digit-heavy lines', () => {
    const merchant = extractMerchant(['فاتورة ضريبية', '300012345678903', 'الدانوب']);
    assert.equal(merchant, 'الدانوب');
  });

  it('returns null when the top lines carry no name', () => {
    assert.equal(extractMerchant(['فاتورة ضريبية', '12345', '======']), null);
  });
});

describe('parseReceiptText', () => {
  it('reads a whole receipt in one pass', () => {
    const parsed = parseReceiptText(jarirReceipt, today);
    assert.deepEqual(parsed, {
      merchant: 'مكتبة جرير',
      totalMinor: 414_800,
      purchaseDate: '2026-03-15',
      vatNumber: '300012345678903',
    });
  });

  it('degrades field by field rather than failing outright', () => {
    // A photo the recogniser could make nothing of: separators and noise only.
    const parsed = parseReceiptText('=======\n-------\n***', today);
    assert.deepEqual(parsed, { merchant: null, totalMinor: null, purchaseDate: null, vatNumber: null });
  });
});
