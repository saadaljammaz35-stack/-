import { describe, expect, it, vi } from 'vitest';
import { verifyCheck, verifyStart } from '@/lib/notify/twilio-verify';

const cfg = { sid: 'AC123', token: 'tok', serviceSid: 'VA456' };
const ok = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('Twilio Verify adapter', () => {
  it('starts an SMS verification with the right URL, auth and form', async () => {
    const f = vi.fn(async () => ok({ status: 'pending' }, 201));
    expect(await verifyStart(cfg, '+966501234567', 'ar', f as unknown as typeof fetch)).toBe(true);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://verify.twilio.com/v2/Services/VA456/Verifications');
    expect((init.headers as Record<string, string>).Authorization).toBe(`Basic ${Buffer.from('AC123:tok').toString('base64')}`);
    const form = new URLSearchParams(init.body as URLSearchParams);
    expect(form.get('To')).toBe('+966501234567');
    expect(form.get('Channel')).toBe('sms');
    expect(form.get('Locale')).toBe('ar');
  });

  it('reports a failed start (e.g. bad credentials) as false', async () => {
    const f = vi.fn(async () => ok({ message: 'Authenticate' }, 401));
    expect(await verifyStart(cfg, '+966501234567', 'en', f as unknown as typeof fetch)).toBe(false);
  });

  it('accepts only an approved check', async () => {
    const approved = vi.fn(async () => ok({ status: 'approved', valid: true }));
    const pending = vi.fn(async () => ok({ status: 'pending', valid: false }));
    const expired = vi.fn(async () => ok({ message: 'not found' }, 404));
    expect(await verifyCheck(cfg, '+966501234567', '123456', approved as unknown as typeof fetch)).toBe(true);
    expect(await verifyCheck(cfg, '+966501234567', '000000', pending as unknown as typeof fetch)).toBe(false);
    expect(await verifyCheck(cfg, '+966501234567', '123456', expired as unknown as typeof fetch)).toBe(false);
    const [url] = approved.mock.calls[0] as unknown as [string];
    expect(url).toBe('https://verify.twilio.com/v2/Services/VA456/VerificationCheck');
  });
});
