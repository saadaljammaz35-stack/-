import { expect, type Browser, type BrowserContext, type Page, devices } from '@playwright/test';
import zlib from 'node:zlib';

const MAILPIT = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324';

export async function mobileContext(browser: Browser, locale: 'ar' | 'en' = 'ar'): Promise<BrowserContext> {
  const { defaultBrowserType: _d, ...iphone } = devices['iPhone 14'];
  void _d;
  const ctx = await browser.newContext({ ...iphone });
  // the 'add to home screen' tip is tested on its own; keep it out of the way elsewhere
  await ctx.addInitScript(() => { try { localStorage.setItem('samat_install_dismissed', String(Date.now())); } catch { /* ignore */ } });
  await ctx.addCookies([{ name: 'samat_lang', value: locale, url: 'http://localhost:3000' }]);
  return ctx;
}

export async function desktopContext(browser: Browser, locale: 'ar' | 'en' = 'ar'): Promise<BrowserContext> {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  await ctx.addCookies([{ name: 'samat_lang', value: locale, url: 'http://localhost:3000' }]);
  return ctx;
}

/** Reads the newest sign-in code e-mailed to `email` (local Mailpit). */
export async function latestCode(email: string, after: number): Promise<string> {
  for (let i = 0; i < 40; i++) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
    const json = (await res.json()) as { messages: { ID: string; Created: string }[] };
    const fresh = json.messages.filter((m) => new Date(m.Created).getTime() >= after - 2000);
    if (fresh.length) {
      const msg = (await (await fetch(`${MAILPIT}/api/v1/message/${fresh[0].ID}`)).json()) as { Text: string; HTML: string };
      const code = /\b(\d{6})\b/.exec(msg.Text || msg.HTML)?.[1];
      if (code) return code;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`no code e-mail for ${email}`);
}

/** The sign-in link from the newest staff e-mail sent to `email` after `after`. */
export async function latestLink(email: string, after: number): Promise<string> {
  for (let i = 0; i < 40; i++) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
    const json = (await res.json()) as { messages: { ID: string; Created: string }[] };
    const fresh = json.messages.filter((m) => new Date(m.Created).getTime() >= after - 2000);
    if (fresh.length) {
      const msg = (await (await fetch(`${MAILPIT}/api/v1/message/${fresh[0].ID}`)).json()) as { HTML: string };
      const href = /href="([^"]*\/auth\/v1\/verify[^"]*)"/.exec(msg.HTML)?.[1];
      if (href) return href.replace(/&amp;/g, '&');
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`no sign-in link e-mail for ${email}`);
}

export async function staffLogin(page: Page, email: string, next = '/admin') {
  await page.goto(`/admin/login?mode=code&next=${encodeURIComponent(next)}`);
  const t0 = Date.now();
  await page.getByTestId('staff-email').fill(email);
  await page.getByTestId('staff-submit').click();
  await expect(page.getByTestId('staff-code')).toBeVisible();
  await page.getByTestId('staff-code').fill(await latestCode(email, t0));
  await page.getByTestId('staff-submit').click();
}

/** The newest sign-in code the app wrote to its local SMS outbox for `phone` (+9665…) after `after`. */
export async function latestSmsCode(phone: string, after: number): Promise<string> {
  const { readFile } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  for (let i = 0; i < 40; i++) {
    const raw = await readFile(`${tmpdir()}/samat-sms-outbox.jsonl`, 'utf8').catch(() => '');
    const hit = raw.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l) as { phone: string; code: string; at: string })
      .filter((m) => m.phone === phone && Date.parse(m.at) >= after - 2000).pop();
    if (hit) return hit.code;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`no SMS code for ${phone}`);
}

/** A real (tiny) PNG to upload as a transfer receipt. */
export function receiptPng(): Buffer {
  const w = 40, h = 20;
  const raw = Buffer.alloc((w * 3 + 1) * h, 0xee);
  for (let y = 0; y < h; y++) raw[y * (w * 3 + 1)] = 0;
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

export const priceOf = async (page: Page) => Number(await page.getByTestId('live-price').first().getAttribute('data-value'));
