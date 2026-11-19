import { createHmac, timingSafeEqual } from 'node:crypto';
import { env, isProduction } from '@/lib/env';
import { sendSms, sendWhatsAppTemplate, smsConfigured, whatsappConfigured } from '@/lib/notify/channels';

// Supabase Auth "Send SMS" hook (Standard Webhooks). Lets phone OTP go through any Saudi SMS
// provider (Unifonic / Taqnyat) or Twilio, instead of only the providers Supabase supports natively.
function verify(body: string, headers: Headers): boolean {
  const raw = env.sendSmsHookSecrets;
  if (!raw) return false;
  const id = headers.get('webhook-id');
  const ts = headers.get('webhook-timestamp');
  const sigs = headers.get('webhook-signature');
  if (!id || !ts || !sigs) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const expected = Buffer.from(
    createHmac('sha256', Buffer.from(raw.replace(/^v1,whsec_/, ''), 'base64')).update(`${id}.${ts}.${body}`).digest('base64'),
  );
  return sigs.split(' ').some((s) => {
    const given = Buffer.from(s.replace(/^v1,/, ''));
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

export async function POST(req: Request) {
  const body = await req.text();
  if (!verify(body, req.headers)) return Response.json({ error: { http_code: 401, message: 'invalid signature' } }, { status: 401 });
  const payload = JSON.parse(body) as { user?: { phone?: string }; sms?: { otp?: string } };
  const phone = payload.user?.phone ? `+${payload.user.phone.replace(/^\+/, '')}` : null;
  const otp = payload.sms?.otp;
  if (!phone || !otp) return Response.json({ error: { http_code: 400, message: 'bad payload' } }, { status: 400 });

  const text = `رمز التحقق لسماط: ${otp}\nSAMAT code: ${otp}`;
  if (smsConfigured()) {
    const r = await sendSms(phone, text);
    if (r.status === 'sent') return Response.json({});
    return Response.json({ error: { http_code: 502, message: r.error ?? 'sms failed' } }, { status: 502 });
  }
  if (whatsappConfigured()) {
    // requires an approved authentication template named samat_otp with the code as {{1}}
    const r = await sendWhatsAppTemplate(phone, 'samat_otp', env.whatsapp.langAr, [otp]);
    if (r.status === 'sent') return Response.json({});
  }
  if (!isProduction) {
    console.info(`[dev] OTP for ${phone}: ${otp}`); // local development only
    return Response.json({});
  }
  return Response.json({ error: { http_code: 503, message: 'No SMS provider configured' } }, { status: 503 });
}
