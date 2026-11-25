import 'server-only';
import { isEmailConfigured, serverEnv } from '@/lib/server-env';

interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

/**
 * Sends a transactional email through Resend's HTTP API. Returns false when email is not configured or the
 * provider rejects the message; callers then fall back to an honest "we'll be in touch" state.
 */
export async function sendEmail(message: EmailMessage): Promise<boolean> {
  if (!isEmailConfigured()) return false;
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${serverEnv.resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: serverEnv.emailFrom,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
        ...(message.replyTo ? { reply_to: message.replyTo } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      console.error('[email] provider error', response.status, await response.text().catch(() => ''));
      return false;
    }
    return true;
  } catch (error) {
    console.error('[email] request failed', error);
    return false;
  }
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** Minimal, accessible email layout in the Wared palette. */
export function emailLayout(locale: 'ar' | 'en', heading: string, bodyHtml: string): string {
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  return `<!doctype html><html lang="${locale}" dir="${dir}"><body style="margin:0;background:#F2EFE8;color:#171717;font-family:'IBM Plex Sans Arabic',Tahoma,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px">
<table role="presentation" width="100%" style="max-width:560px" cellpadding="0" cellspacing="0">
<tr><td style="font-size:28px;font-weight:700;padding-bottom:24px">${locale === 'ar' ? 'وارد' : 'Wared'}</td></tr>
<tr><td style="font-size:22px;font-weight:700;padding-bottom:16px">${escapeHtml(heading)}</td></tr>
<tr><td style="font-size:16px;line-height:1.8">${bodyHtml}</td></tr>
<tr><td style="padding-top:32px;font-size:13px;color:#5f5f5f">${locale === 'ar' ? 'كل شيء وارد.' : 'Anything is possible.'}</td></tr>
</table></td></tr></table></body></html>`;
}
