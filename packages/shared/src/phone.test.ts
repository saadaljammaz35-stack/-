import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ValidationError } from './errors.js';
import {
  formatPhone,
  isValidMobile,
  maskPhoneForConfirmation,
  normalisePhone,
  parsePhone,
  toAsciiDigits,
  tryNormalisePhone,
} from './phone.js';

describe('Phone normalisation — every form a person might type', () => {
  const CANONICAL = '+966512345678';

  it('normalises all Saudi input forms to one identity', () => {
    // If any of these normalised differently, the same person would become two
    // unreachable identities and a transfer would silently go nowhere.
    const forms = [
      '+966512345678',
      '00966512345678',
      '966512345678',
      '0512345678',
      '512345678',
      '+966 51 234 5678',
      '+966-51-234-5678',
      '(0) 512 345 678',
      '05 1234 5678',
      ' 0512345678 ',
    ];
    for (const form of forms) {
      assert.equal(normalisePhone(form), CANONICAL, `failed to normalise: "${form}"`);
    }
  });

  it('accepts Arabic-Indic digits from an Arabic keyboard', () => {
    assert.equal(normalisePhone('٠٥١٢٣٤٥٦٧٨'), CANONICAL);
    assert.equal(normalisePhone('+٩٦٦٥١٢٣٤٥٦٧٨'), CANONICAL);
    // Eastern Arabic-Indic (Persian) digits too.
    assert.equal(normalisePhone('۰۵۱۲۳۴۵۶۷۸'), CANONICAL);
    assert.equal(toAsciiDigits('٠١٢٣٤٥٦٧٨٩'), '0123456789');
  });

  it('is idempotent — normalising an already-normalised number is a no-op', () => {
    assert.equal(normalisePhone(normalisePhone('0512345678')), CANONICAL);
  });

  it('reports Saudi mobile numbers as mobile', () => {
    assert.equal(isValidMobile('0512345678'), true);
    assert.equal(isValidMobile('+966512345678'), true);
    // Saudi landlines start with 1, not 5.
    assert.equal(isValidMobile('0112345678'), false);
  });

  it('rejects malformed numbers rather than guessing', () => {
    const bad = [
      '',
      '   ',
      '05123',
      '05123456789012',
      'not-a-number',
      '+966',
      '05123456ab',
      '++966512345678',
    ];
    for (const value of bad) {
      assert.throws(
        () => normalisePhone(value),
        ValidationError,
        `expected reject: "${value}"`,
      );
    }
  });

  it('does not echo the number in the error, since errors reach logs', () => {
    try {
      normalisePhone('0512345ABC');
      assert.fail('should have thrown');
    } catch (error) {
      assert.ok(error instanceof ValidationError);
      assert.ok(
        !JSON.stringify(error.details).includes('0512345'),
        'a phone number is personal data and must not be echoed into a log',
      );
    }
  });

  it('offers a non-throwing variant for client-side validation', () => {
    assert.equal(tryNormalisePhone('0512345678'), '+966512345678');
    assert.equal(tryNormalisePhone('nonsense'), null);
  });

  it('handles other supported markets without mangling them', () => {
    assert.equal(normalisePhone('+971501234567'), '+971501234567');
    assert.equal(normalisePhone('+96550123456'), '+96550123456');
    assert.equal(normalisePhone('+97333123456'), '+97333123456');
  });

  it('parses the structure, not just the string', () => {
    const parsed = parsePhone('0512345678');
    assert.equal(parsed.countryIso, 'SA');
    assert.equal(parsed.dialCode, '966');
    assert.equal(parsed.nationalNumber, '512345678');
    assert.equal(parsed.isMobile, true);
  });
});

describe('Phone display', () => {
  it('formats for readability', () => {
    assert.equal(formatPhone('+966512345678'), '+966 51 234 5678');
  });

  it('masks when confirming a recipient, so the app is not a directory', () => {
    const masked = maskPhoneForConfirmation('+966512345678');
    assert.equal(masked, '+966 51••••78');
    assert.ok(!masked.includes('2345'), 'the middle digits must not be shown');
  });
});
