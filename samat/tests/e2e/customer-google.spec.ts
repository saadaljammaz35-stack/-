import { generateKeyPairSync, sign } from 'node:crypto';
import http from 'node:http';
import { expect, test } from '@playwright/test';
import pg from 'pg';
import { mobileContext } from './helpers';

const DB = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const CLIENT = 'e2e-client.apps.googleusercontent.com'; // matches .env.local (local tests only)

test('Google customer: signs in, sees their account, gives the phone once at checkout and it is remembered', async ({ browser }) => {
  const kid = `e2e-${Date.now()}`;
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const server = http.createServer((_req, res) => {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ keys: [{ ...publicKey.export({ format: 'jwk' }), kid, alg: 'RS256', use: 'sig' }] }));
  });
  await new Promise<void>((r) => server.listen(54399, '127.0.0.1', r));
  try {
    const sub = String(Date.now());
    const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    const h = b64({ alg: 'RS256', kid, typ: 'JWT' });
    const p = b64({ iss: 'https://accounts.google.com', aud: CLIENT, sub, email: `g${sub}@example.com`, email_verified: true, name: 'عميل قوقل', iat: now, exp: now + 600 });
    const credential = `${h}.${p}.${sign('RSA-SHA256', Buffer.from(`${h}.${p}`), privateKey).toString('base64url')}`;

    const ctx = await mobileContext(browser);
    const page = await ctx.newPage();
    // a forged token is refused
    expect((await page.request.post('/api/auth/google', { data: { credential: `${h}.${p}.${'A'.repeat(342)}` } })).status()).toBe(400);
    expect((await page.request.post('/api/auth/google', { data: { credential } })).status()).toBe(200);

    await page.goto('/account');
    await expect(page.getByTestId('loyalty-card')).toBeVisible();
    await expect(page.getByText('عميل قوقل')).toBeVisible();

    const mobile = `05${sub.slice(-8)}`;
    await page.goto('/p/samat-burger');
    await page.getByTestId('add-to-cart').click();
    await page.goto('/checkout');
    await expect(page.getByTestId('name')).toHaveValue('عميل قوقل');
    await expect(page.getByTestId('phone')).toHaveValue('');
    await page.getByTestId('phone').fill(mobile);
    await expect(page.getByTestId('checkout-earn')).toContainText('بتكسب');
    await page.getByTestId('place-order').click();
    await page.waitForURL(/\/pay\//);

    const c = new pg.Client({ connectionString: DB });
    await c.connect();
    const { rows } = await c.query("select p.phone, o.customer_id is not null as linked from public.profiles p join public.orders o on o.customer_id = p.id where p.email = $1", [`g${sub}@example.com`]);
    await c.end();
    expect(rows[0]).toEqual({ phone: `+966${mobile.slice(1)}`, linked: true });

    await page.goto('/checkout');
    await expect(page.getByTestId('phone')).toHaveValue(`0${mobile.slice(1)}`);
    await ctx.close();
  } finally {
    server.close();
  }
});
