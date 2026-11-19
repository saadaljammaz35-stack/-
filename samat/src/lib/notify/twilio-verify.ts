/**
 * Twilio Verify: Twilio generates, sends (SMS) and checks the sign-in code itself, and takes care
 * of sender registration in countries that require it — no commercial registration or sender name
 * of our own is needed. Needs TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_VERIFY_SERVICE_SID.
 */
export interface VerifyConfig { sid: string; token: string; serviceSid: string }
type Fetch = typeof fetch;

const base = (c: VerifyConfig) => `https://verify.twilio.com/v2/Services/${encodeURIComponent(c.serviceSid)}`;
const auth = (c: VerifyConfig) => `Basic ${Buffer.from(`${c.sid}:${c.token}`).toString('base64')}`;

/** Asks Twilio to text a code to `phone` (E.164). */
export async function verifyStart(c: VerifyConfig, phone: string, locale: 'ar' | 'en', f: Fetch = fetch): Promise<boolean> {
  try {
    const res = await f(`${base(c)}/Verifications`, {
      method: 'POST',
      headers: { Authorization: auth(c), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: phone, Channel: 'sms', Locale: locale }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) { console.error('[twilio-verify] start', res.status, (await res.text()).slice(0, 200)); return false; }
    return true;
  } catch (e) {
    console.error('[twilio-verify] start', (e as Error).message);
    return false;
  }
}

/** True only when Twilio says this code is right for `phone`. */
export async function verifyCheck(c: VerifyConfig, phone: string, code: string, f: Fetch = fetch): Promise<boolean> {
  try {
    const res = await f(`${base(c)}/VerificationCheck`, {
      method: 'POST',
      headers: { Authorization: auth(c), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: phone, Code: code }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return false; // 404 = expired / already used
    const json = (await res.json()) as { status?: string; valid?: boolean };
    return json.status === 'approved' && json.valid !== false;
  } catch {
    return false;
  }
}
