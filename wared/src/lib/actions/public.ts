'use server';

import { z } from 'zod';
import { emailLayout, escapeHtml, sendEmail } from '@/lib/email';
import { absoluteUrl } from '@/lib/env';
import { hasAppSecret, isEmailConfigured, serverEnv } from '@/lib/server-env';
import { rateLimit } from '@/lib/security/rate-limit';
import { getRequestMeta } from '@/lib/security/request';
import { randomToken, sha256, verifyFormToken } from '@/lib/security/tokens';
import { getServiceClient } from '@/lib/supabase/admin';
import {
  careersSchema,
  contactSchema,
  fieldErrors,
  newsletterSchema,
  sponsorshipSchema,
} from '@/lib/validation/public';

export type FormResult =
  | { ok: true; message: 'sent' | 'successConfirm' | 'successPending' }
  | { ok: false; message: 'error' | 'rateLimited' | 'unavailable' | 'invalid'; fieldErrors?: Record<string, string> };

const SPAM_SWALLOWED: FormResult = { ok: true, message: 'sent' };

type Guarded = { website_confirm?: string; _t?: string };

/** Shared checks for every public form: honeypot, signed timing token and per-IP rate limit. */
async function guard(form: string, data: Guarded, limit: number): Promise<FormResult | null> {
  if (!hasAppSecret()) return { ok: false, message: 'unavailable' };
  if (data.website_confirm) return SPAM_SWALLOWED;
  if (!verifyFormToken(form, data._t)) return SPAM_SWALLOWED;
  const meta = await getRequestMeta();
  if (!(await rateLimit(`form:${form}:${meta.ipHash}`, limit, 3600))) {
    return { ok: false, message: 'rateLimited' };
  }
  return null;
}

async function notifyTeam(subject: string, rows: [string, string | undefined | null][]) {
  if (!serverEnv.inboxNotifyEmail || !isEmailConfigured()) return;
  const body = rows
    .filter(([, v]) => v)
    .map(([k, v]) => `<p><strong>${escapeHtml(k)}:</strong><br>${escapeHtml(String(v)).replace(/\n/g, '<br>')}</p>`)
    .join('');
  const text = rows.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join('\n\n');
  await sendEmail({ to: serverEnv.inboxNotifyEmail, subject, html: emailLayout('ar', subject, body), text });
}

function invalid(error: z.ZodError): FormResult {
  return { ok: false, message: 'invalid', fieldErrors: fieldErrors(error) };
}

export async function submitContact(input: unknown): Promise<FormResult> {
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const blocked = await guard('contact', parsed.data, 5);
  if (blocked) return blocked;
  const db = getServiceClient();
  if (!db) return { ok: false, message: 'unavailable' };
  const { kind, name, email, subject, message, locale } = parsed.data;
  const { error } = await db.from('contact_messages').insert({ kind, name, email, subject: subject ?? null, message, locale });
  if (error) {
    console.error('[contact] insert failed', error.message);
    return { ok: false, message: 'error' };
  }
  await notifyTeam(`رسالة جديدة من ${name}`, [['النوع', kind], ['الاسم', name], ['البريد', email], ['الموضوع', subject], ['الرسالة', message]]);
  return { ok: true, message: 'sent' };
}

export async function submitCareers(input: unknown): Promise<FormResult> {
  const parsed = careersSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const blocked = await guard('careers', parsed.data, 3);
  if (blocked) return blocked;
  const db = getServiceClient();
  if (!db) return { ok: false, message: 'unavailable' };
  const { name, email, position, portfolio, message, locale } = parsed.data;
  const { error } = await db.from('contact_messages').insert({
    kind: 'careers',
    name,
    email,
    subject: position,
    position,
    portfolio_url: portfolio ?? null,
    message,
    locale,
  });
  if (error) {
    console.error('[careers] insert failed', error.message);
    return { ok: false, message: 'error' };
  }
  await notifyTeam(`طلب انضمام: ${name}`, [['الاسم', name], ['البريد', email], ['الدور', position], ['الأعمال', portfolio], ['الرسالة', message]]);
  return { ok: true, message: 'sent' };
}

export async function submitSponsorship(input: unknown): Promise<FormResult> {
  const parsed = sponsorshipSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const blocked = await guard('sponsorship', parsed.data, 3);
  if (blocked) return blocked;
  const db = getServiceClient();
  if (!db) return { ok: false, message: 'unavailable' };
  const d = parsed.data;
  const { error } = await db.from('sponsorship_requests').insert({
    company: d.company,
    contact_name: d.contactName,
    email: d.email,
    phone: d.phone ?? null,
    website: d.website ?? null,
    budget_range: d.budget ?? null,
    interests: d.interests,
    message: d.message,
    locale: d.locale,
  });
  if (error) {
    console.error('[sponsorship] insert failed', error.message);
    return { ok: false, message: 'error' };
  }
  await notifyTeam(`طلب رعاية: ${d.company}`, [
    ['الجهة', d.company],
    ['المسؤول', d.contactName],
    ['البريد', d.email],
    ['الجوال', d.phone],
    ['الموقع', d.website],
    ['الميزانية', d.budget],
    ['الاهتمامات', d.interests.join('، ')],
    ['الرسالة', d.message],
  ]);
  return { ok: true, message: 'sent' };
}

export async function subscribeNewsletter(input: unknown): Promise<FormResult> {
  const parsed = newsletterSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const blocked = await guard('newsletter', parsed.data, 5);
  if (blocked) return blocked;
  const { email, locale, source } = parsed.data;
  if (!(await rateLimit(`newsletter:email:${sha256(email)}`, 3, 3600))) return { ok: false, message: 'rateLimited' };

  const db = getServiceClient();
  if (!db) return { ok: false, message: 'unavailable' };

  const { data: existing, error: lookupError } = await db
    .from('subscribers')
    .select('id, status')
    .eq('email', email)
    .maybeSingle();
  if (lookupError) {
    console.error('[newsletter] lookup failed', lookupError.message);
    return { ok: false, message: 'error' };
  }

  const emailReady = isEmailConfigured();
  // Same answer whether or not the address is already subscribed, so the form cannot be used to probe emails.
  if (existing?.status === 'active') return { ok: true, message: emailReady ? 'successConfirm' : 'successPending' };

  const confirmToken = randomToken();
  const unsubscribeToken = randomToken();
  const row = {
    email,
    status: 'pending' as const,
    locale,
    source: source ?? null,
    confirm_token_hash: sha256(confirmToken),
    unsubscribe_token_hash: sha256(unsubscribeToken),
    unsubscribed_at: null,
  };
  const { error } = existing
    ? await db.from('subscribers').update(row).eq('id', existing.id)
    : await db.from('subscribers').insert(row);
  if (error) {
    console.error('[newsletter] upsert failed', error.message);
    return { ok: false, message: 'error' };
  }

  if (!emailReady) return { ok: true, message: 'successPending' };

  const confirmUrl = absoluteUrl(`/${locale}/newsletter/confirm?token=${encodeURIComponent(confirmToken)}`);
  const unsubscribeUrl = absoluteUrl(`/${locale}/newsletter/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`);
  const ar = locale === 'ar';
  const sent = await sendEmail({
    to: email,
    subject: ar ? 'أكّد اشتراكك في نشرة وارد' : 'Confirm your Wared newsletter subscription',
    html: emailLayout(
      locale,
      ar ? 'خطوة أخيرة' : 'One last step',
      `<p>${ar ? 'اضغط الرابط لتأكيد اشتراكك:' : 'Click the link to confirm your subscription:'}</p>
       <p><a href="${confirmUrl}" style="color:#171717;font-weight:700">${ar ? 'تأكيد الاشتراك' : 'Confirm subscription'}</a></p>
       <p style="font-size:13px;color:#5f5f5f">${ar ? 'إذا ما طلبت الاشتراك، تجاهل هذه الرسالة.' : 'If you did not ask for this, ignore this email.'}
       <a href="${unsubscribeUrl}" style="color:#5f5f5f">${ar ? 'إلغاء' : 'Unsubscribe'}</a></p>`,
    ),
    text: `${ar ? 'تأكيد الاشتراك' : 'Confirm subscription'}: ${confirmUrl}`,
  });
  return { ok: true, message: sent ? 'successConfirm' : 'successPending' };
}

const tokenSchema = z.string().min(20).max(200);

export async function confirmSubscription(token: string): Promise<boolean> {
  const parsed = tokenSchema.safeParse(token);
  const db = getServiceClient();
  if (!parsed.success || !db) return false;
  const { data, error } = await db
    .from('subscribers')
    .update({ status: 'active', confirmed_at: new Date().toISOString(), confirm_token_hash: null })
    .eq('confirm_token_hash', sha256(parsed.data))
    .select('id');
  if (error) console.error('[newsletter] confirm failed', error.message);
  return Boolean(data && data.length > 0);
}

export async function unsubscribe(token: string): Promise<boolean> {
  const parsed = tokenSchema.safeParse(token);
  const db = getServiceClient();
  if (!parsed.success || !db) return false;
  const { data, error } = await db
    .from('subscribers')
    .update({ status: 'unsubscribed', unsubscribed_at: new Date().toISOString(), confirm_token_hash: null })
    .eq('unsubscribe_token_hash', sha256(parsed.data))
    .select('id');
  if (error) console.error('[newsletter] unsubscribe failed', error.message);
  return Boolean(data && data.length > 0);
}
