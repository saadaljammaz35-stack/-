import 'server-only';
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { appendFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { adminDb } from '@/lib/supabase/admin';
import { userDb } from '@/lib/supabase/server';
import { env, isProduction } from '@/lib/env';
import { AppError } from '@/lib/errors';
import { normalizeSaudiPhone } from '@/lib/phone';
import { sendSms, sendWhatsAppTemplate, smsConfigured, whatsappConfigured } from '@/lib/notify/channels';
import { verifyCheck, verifyStart, type VerifyConfig } from '@/lib/notify/twilio-verify';

/**
 * Customer sign-in by SMS code, run by the app itself (no Supabase phone-auth settings needed):
 * the code goes out through the app's SMS provider (or WhatsApp), only its hash is stored, it
 * expires in 5 minutes, allows 5 tries, and can be re-sent once a minute, 5 times an hour.
 * After a correct code the customer gets a normal Supabase session.
 */
const CODE_TTL_MIN = 5;
const RESEND_SECONDS = 60;
const MAX_SENDS_PER_HOUR = 5;
const MAX_ATTEMPTS = 5;
/** Internal sign-in identifier for phone accounts (never shown, never e-mailed). */
const PHONE_EMAIL_DOMAIN = 'phone.samat.invalid';

/** Local development only: codes are written here instead of being sent (like Mailpit for e-mail). */
export const DEV_SMS_OUTBOX = path.join(os.tmpdir(), 'samat-sms-outbox.jsonl');

const hashCode = (phone: string, code: string) => createHash('sha256').update(`${phone}:${code}`).digest('hex');

/** Twilio Verify (sends and checks the code itself; no commercial registration needed). */
function twilioVerify(): VerifyConfig | null {
  const { sid, token, verifyServiceSid, apiKeySid, apiKeySecret } = env.twilio;
  const [user, pass] = apiKeySid && apiKeySecret ? [apiKeySid, apiKeySecret] : [sid, token];
  return user && pass && verifyServiceSid ? { sid: user, token: pass, serviceSid: verifyServiceSid } : null;
}

/** True when a code can actually reach the customer (a provider is set up, or local development). */
export function phoneLoginAvailable(): boolean {
  if (!env.customerPhoneLogin) return false;
  return Boolean(twilioVerify()) || smsConfigured() || whatsappConfigured() || !isProduction;
}

export async function startPhoneLogin(raw: string, locale: 'ar' | 'en'): Promise<{ phone: string }> {
  const phone = normalizeSaudiPhone(raw);
  if (!phone) throw new AppError('invalid_phone');
  if (!phoneLoginAvailable()) throw new AppError('sms_unavailable', 503);
  const db = adminDb();
  const now = Date.now();
  const { data: row } = await db.from('phone_otps').select('last_sent_at, sends_in_window, window_started_at').eq('phone', phone).maybeSingle();
  let sends = 1;
  let windowStart = new Date(now).toISOString();
  if (row) {
    const wait = RESEND_SECONDS - Math.floor((now - Date.parse(row.last_sent_at)) / 1000);
    if (wait > 0) throw new AppError('otp_wait', 429, { seconds: wait });
    if (now - Date.parse(row.window_started_at) < 3600_000) {
      if (row.sends_in_window >= MAX_SENDS_PER_HOUR) throw new AppError('rate_limited', 429);
      sends = row.sends_in_window + 1;
      windowStart = row.window_started_at;
    }
  }
  const verify = twilioVerify();
  // with Twilio Verify the code lives at Twilio; the row still enforces our resend/attempt limits
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const { error } = await db.from('phone_otps').upsert({
    phone, code_hash: hashCode(phone, code), expires_at: new Date(now + CODE_TTL_MIN * 60_000).toISOString(), attempts: 0,
    sends_in_window: sends, window_started_at: windowStart, last_sent_at: new Date(now).toISOString(),
  });
  if (error) throw error;

  const text = locale === 'ar'
    ? `رمز دخولك في سماط: ${code}\nصالح ${CODE_TTL_MIN} دقائق، لا تعطيه لأحد.`
    : `Your SAMAT sign-in code: ${code}\nValid for ${CODE_TTL_MIN} minutes. Do not share it.`;
  let sent = false;
  if (verify) {
    if (!(await verifyStart(verify, phone, locale))) throw new AppError('sms_failed', 502);
    return { phone };
  }
  if (smsConfigured()) sent = (await sendSms(phone, text)).status === 'sent';
  if (!sent && whatsappConfigured()) {
    // needs an approved authentication template named samat_otp with the code as {{1}}
    sent = (await sendWhatsAppTemplate(phone, 'samat_otp', locale === 'ar' ? env.whatsapp.langAr : env.whatsapp.langEn, [code])).status === 'sent';
  }
  if (!sent && !isProduction && !smsConfigured() && !whatsappConfigured()) {
    await appendFile(DEV_SMS_OUTBOX, `${JSON.stringify({ phone, code, at: new Date().toISOString() })}\n`);
    sent = true;
  }
  if (!sent) throw new AppError('sms_failed', 502);
  return { phone };
}

export async function verifyPhoneLogin(raw: string, code: string, locale: 'ar' | 'en'): Promise<{ userId: string }> {
  const phone = normalizeSaudiPhone(raw);
  if (!phone || !/^\d{6}$/.test(code)) throw new AppError('otp_invalid');
  const db = adminDb();
  const { data: row } = await db.from('phone_otps').select('code_hash, expires_at, attempts').eq('phone', phone).maybeSingle();
  if (!row || Date.parse(row.expires_at) < Date.now() || row.attempts >= MAX_ATTEMPTS) throw new AppError('otp_invalid');
  const verify = twilioVerify();
  const right = verify
    ? await verifyCheck(verify, phone, code)
    : timingSafeEqual(Buffer.from(row.code_hash, 'hex'), Buffer.from(hashCode(phone, code), 'hex'));
  if (!right) {
    await db.rpc('phone_otp_fail', { p_phone: phone });
    throw new AppError('otp_invalid');
  }
  // single use: whoever deletes the row first wins
  const { data: used } = await db.from('phone_otps').delete().eq('phone', phone).eq('code_hash', row.code_hash).select('phone');
  if (!used?.length) throw new AppError('otp_invalid');

  const email = `${phone.slice(1)}@${PHONE_EMAIL_DOMAIN}`;
  const password = randomBytes(32).toString('base64url'); // fresh every sign-in, never stored
  const { data: found, error: e1 } = await db.rpc('auth_user_by_phone', { p_phone: phone });
  if (e1) throw e1;
  const existing = (found as { id: string; email: string | null }[] | null)?.[0];
  if (existing) {
    // an e-mail (staff) account that happens to carry this phone is never touched from here
    if (existing.email && !existing.email.endsWith(`@${PHONE_EMAIL_DOMAIN}`)) throw new AppError('phone_in_use', 409);
    const r = await db.auth.admin.updateUserById(existing.id, { email, email_confirm: true, phone_confirm: true, password });
    if (r.error) throw r.error;
  } else {
    const r = await db.auth.admin.createUser({ phone, phone_confirm: true, email, email_confirm: true, password });
    if (r.error) throw r.error;
  }
  const session = await userDb();
  const { data, error } = await session.auth.signInWithPassword({ email, password });
  if (error || !data.user) throw error ?? new AppError('unknown', 500);
  await db.from('profiles').upsert({ id: data.user.id, phone, locale }, { onConflict: 'id', ignoreDuplicates: true });
  await db.from('loyalty_accounts').upsert({ customer_id: data.user.id }, { onConflict: 'customer_id', ignoreDuplicates: true });
  return { userId: data.user.id };
}
