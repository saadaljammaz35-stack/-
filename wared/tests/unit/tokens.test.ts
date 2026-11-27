import { describe, expect, it } from 'vitest';
import { hashIp, issueFormToken, randomToken, sha256, verifyFormToken } from '@/lib/security/tokens';

describe('form timing tokens', () => {
  const t0 = 1_800_000_000_000;
  it('accepts a token submitted after a few seconds', () => {
    expect(verifyFormToken('contact', issueFormToken('contact', t0), t0 + 5_000)).toBe(true);
  });
  it('rejects instant, expired, forged and cross-form tokens', () => {
    const token = issueFormToken('contact', t0);
    expect(verifyFormToken('contact', token, t0 + 500)).toBe(false);
    expect(verifyFormToken('contact', token, t0 + 25 * 3600_000)).toBe(false);
    expect(verifyFormToken('newsletter', token, t0 + 5_000)).toBe(false);
    expect(verifyFormToken('contact', `${t0}.forged`, t0 + 5_000)).toBe(false);
    expect(verifyFormToken('contact', undefined, t0)).toBe(false);
    expect(verifyFormToken('contact', 'garbage', t0)).toBe(false);
  });
});

describe('hashing helpers', () => {
  it('never returns the raw IP and is stable', () => {
    expect(hashIp('203.0.113.7')).not.toContain('203');
    expect(hashIp('203.0.113.7')).toBe(hashIp('203.0.113.7'));
    expect(hashIp('203.0.113.7')).not.toBe(hashIp('203.0.113.8'));
  });
  it('creates url-safe random tokens and hex digests', () => {
    expect(randomToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(randomToken()).not.toBe(randomToken());
    expect(sha256('a')).toHaveLength(64);
  });
});
