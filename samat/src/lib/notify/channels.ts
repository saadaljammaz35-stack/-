import 'server-only';
import nodemailer from 'nodemailer';
import { env } from '@/lib/env';

export interface SendResult {
  status: 'sent' | 'failed' | 'skipped';
  providerId?: string;
  error?: string;
}

// ---------------------------------------------------------------------------------------- e-mail
export function emailConfigured(): boolean {
  if (env.emailProvider === 'resend') return Boolean(env.resendApiKey);
  if (env.emailProvider === 'smtp') return Boolean(env.smtp.host);
  return false;
}

export async function sendEmail(to: string, subject: string, html: string, text: string): Promise<SendResult> {
  if (!emailConfigured()) return { status: 'skipped', error: 'email provider not configured' };
  try {
    if (env.emailProvider === 'resend') {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.resendApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: env.emailFrom, to: [to], subject, html, text }),
        signal: AbortSignal.timeout(15_000),
      });
      const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
      if (!res.ok) return { status: 'failed', error: json.message ?? `HTTP ${res.status}` };
      return { status: 'sent', providerId: json.id };
    }
    const transport = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.secure,
      auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
    });
    const info = await transport.sendMail({ from: env.emailFrom, to, subject, html, text });
    return { status: 'sent', providerId: info.messageId };
  } catch (e) {
    return { status: 'failed', error: e instanceof Error ? e.message : String(e) };
  }
}

// ------------------------------------------------------------------------------------------- SMS
export function smsConfigured(): boolean {
  switch (env.smsProvider) {
    case 'unifonic': return Boolean(env.unifonicAppSid);
    case 'taqnyat': return Boolean(env.taqnyatToken);
    case 'twilio': return Boolean(env.twilio.sid && env.twilio.token && env.twilio.from);
    default: return false;
  }
}

/** phone in E.164 (+9665XXXXXXXX) */
export async function sendSms(phone: string, body: string): Promise<SendResult> {
  if (!smsConfigured()) return { status: 'skipped', error: 'sms provider not configured' };
  const intl = phone.replace(/^\+/, '');
  try {
    let res: Response;
    if (env.smsProvider === 'unifonic') {
      res = await fetch('https://el.cloud.unifonic.com/rest/SMS/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ AppSid: env.unifonicAppSid!, SenderID: env.smsSender, Recipient: intl, Body: body }),
        signal: AbortSignal.timeout(15_000),
      });
    } else if (env.smsProvider === 'taqnyat') {
      res = await fetch('https://api.taqnyat.sa/v1/messages', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.taqnyatToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipients: [intl], body, sender: env.smsSender }),
        signal: AbortSignal.timeout(15_000),
      });
    } else {
      res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.twilio.sid}/Messages.json`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${env.twilio.sid}:${env.twilio.token}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: phone, From: env.twilio.from!, Body: body }),
        signal: AbortSignal.timeout(15_000),
      });
    }
    const text = await res.text();
    if (!res.ok) return { status: 'failed', error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
    let id: string | undefined;
    try { const j = JSON.parse(text); id = j.sid ?? j.messageId ?? j.data?.MessageID; } catch { /* ignore */ }
    return { status: 'sent', providerId: id ? String(id) : undefined };
  } catch (e) {
    return { status: 'failed', error: e instanceof Error ? e.message : String(e) };
  }
}

// ------------------------------------------------------------------------------------- WhatsApp
export function whatsappConfigured(): boolean {
  return env.whatsapp.enabled && Boolean(env.whatsapp.phoneNumberId && env.whatsapp.token);
}

/**
 * WhatsApp Business messages outside a 24h customer window must use pre-approved templates.
 * Template names: samat_order_<event> with the order number as the single body parameter.
 */
export async function sendWhatsAppTemplate(phone: string, template: string, lang: string, params: string[]): Promise<SendResult> {
  if (!whatsappConfigured()) return { status: 'skipped', error: 'whatsapp not configured' };
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${env.whatsapp.phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.whatsapp.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone.replace(/^\+/, ''),
        type: 'template',
        template: {
          name: template,
          language: { code: lang },
          components: [{ type: 'body', parameters: params.map((text) => ({ type: 'text', text })) }],
        },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const json = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message: string } };
    if (!res.ok) return { status: 'failed', error: json.error?.message ?? `HTTP ${res.status}` };
    return { status: 'sent', providerId: json.messages?.[0]?.id };
  } catch (e) {
    return { status: 'failed', error: e instanceof Error ? e.message : String(e) };
  }
}
