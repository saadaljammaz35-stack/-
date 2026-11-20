import { expect, test, type Browser, type Page } from '@playwright/test';
import pg from 'pg';
import { desktopContext, latestSmsCode, mobileContext, staffLogin } from './helpers';

const OWNER = process.env.E2E_OWNER_EMAIL ?? 'owner@samat.local';
const DB = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const q = async (sql: string, args: unknown[] = []) => {
  const c = new pg.Client({ connectionString: DB });
  await c.connect();
  try { return (await c.query(sql, args)).rows; } finally { await c.end(); }
};

async function signUp(browser: Browser): Promise<{ page: Page; phone: string; id: string }> {
  const local = `05${String(Date.now()).slice(-8)}`;
  const phone = `+966${local.slice(1)}`;
  const page = await (await mobileContext(browser)).newPage();
  await page.goto('/account');
  const t0 = Date.now();
  await page.getByTestId('login-phone').fill(local);
  await page.getByTestId('login-submit').click();
  await page.getByTestId('login-code').fill(await latestSmsCode(phone, t0));
  await page.getByTestId('login-submit').click();
  await expect(page.getByTestId('loyalty-card')).toBeVisible();
  const [{ id }] = await q('select id from public.profiles where phone = $1', [phone]);
  return { page, phone, id };
}

test.describe.serial('engagement features', () => {
  test.beforeAll(async () => {
    await q("delete from public.rate_limits where key like 'otp:%'");
    await q("update public.store_settings set accepting_orders = true, busy_mode = false, loyalty_enabled = true, whatsapp_number = '+966500000099' where id = 1");
  });
  test.afterAll(async () => {
    await q('update public.store_settings set whatsapp_number = null, loyalty_birthday_points = 0, loyalty_stamp_target = 0, loyalty_stamp_reward_points = 0 where id = 1');
  });

  test('WhatsApp button, installable app (service worker) and add-ons in the cart', async ({ browser }) => {
    const page = await (await mobileContext(browser)).newPage();
    await page.goto('/');
    await expect(page.getByTestId('whatsapp')).toHaveAttribute('href', /wa\.me\/966500000099/);
    await page.waitForFunction(async () => Boolean(await navigator.serviceWorker.getRegistration()), null, { timeout: 15_000 });
    expect((await page.request.get('/manifest.webmanifest')).ok()).toBe(true);
    // cart suggests a ready-made item not yet in the cart, and adds it in one tap
    await page.goto('/p/samat-burger');
    await page.getByTestId('add-to-cart').click();
    await page.goto('/cart');
    await expect(page.getByTestId('upsell')).toBeVisible();
    await page.getByTestId('upsell-add').first().click();
    await expect(page.getByTestId('cart-line')).toHaveCount(2);
  });

  test('favourite build: save from the builder, order it from the account page', async ({ browser }) => {
    const { page } = await signUp(browser);
    await page.goto('/p/samat-burger');
    await page.getByTestId('fav-open').click();
    await page.getByTestId('fav-name').fill('برغري');
    await page.getByTestId('fav-save').click();
    await expect(page.getByTestId('fav-saved')).toBeVisible();
    await page.goto('/account');
    await expect(page.getByTestId('favorites')).toContainText('برغري');
    await page.getByTestId('fav-to-cart').click();
    await page.waitForURL(/\/cart$/);
    await expect(page.getByTestId('cart-line')).toHaveCount(1);
  });

  test('birthday gift once a year, and a full stamp card gives its points', async ({ browser }) => {
    await q('update public.store_settings set loyalty_birthday_points = 40, loyalty_stamp_target = 2, loyalty_stamp_reward_points = 25 where id = 1');
    const { page, id } = await signUp(browser);
    await expect(page.getByTestId('birthday-card')).toBeVisible();
    await expect(page.getByTestId('stamp-card')).toBeVisible();
    const today = new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10).replace(/^\d{4}/, '1995');
    await page.getByTestId('birthday-input').fill(today);
    await page.getByTestId('birthday-save').click();
    await expect(page.getByTestId('birthday-card')).toHaveCount(0);
    await q('select public.loyalty_birthday_run()');
    await q('select public.loyalty_birthday_run()'); // second run the same day: no double gift
    // two picked-up orders fill the card (orders moved to this customer, then handed over)
    const orders = await q("select id from public.orders where status in ('ready', 'preparing', 'accepted') order by created_at desc limit 2");
    test.skip(orders.length < 2, 'needs two open orders from the journey tests');
    for (const o of orders) {
      await q('update public.orders set customer_id = $1 where id = $2', [id, o.id]);
      await q("update public.orders set status = 'delivered', delivered_at = now() where id = $1", [o.id]);
    }
    await page.reload();
    await expect(page.getByTestId('points-balance')).toContainText(String(40 + 25));
    const gifts = await q("select note, points from public.loyalty_transactions where customer_id = $1 and type = 'adjust' order by id", [id]);
    expect(gifts.map((g) => g.note)).toEqual(['Birthday gift', 'Stamp card reward']);
  });

  test('rating after pickup shows on the order and the dashboard; daily report and alerts endpoints', async ({ browser, request }) => {
    const [o] = await q("select o.id, o.tracking_token from public.orders o left join public.order_ratings r on r.order_id = o.id where o.status = 'delivered' and r.order_id is null order by o.created_at desc limit 1");
    test.skip(!o, 'needs a delivered order');
    const page = await (await mobileContext(browser)).newPage();
    await page.goto(`/t/${o.tracking_token}`);
    await page.getByTestId('star-5').click();
    await page.getByTestId('rating-send').click();
    await expect(page.getByTestId('rating-box')).toContainText('شكراً');
    expect((await request.post(`/api/track/${o.tracking_token}/rate`, { data: { rating: 1 } })).status()).toBe(409);

    // push subscriptions: an order's tracking link can subscribe; staff need a session
    const sub = { endpoint: `https://push.example.invalid/${Date.now()}`, keys: { p256dh: 'B'.repeat(87), auth: 'A'.repeat(22) } };
    expect((await request.post('/api/push/subscribe', { data: { kind: 'order', token: o.tracking_token, subscription: sub } })).status()).toBe(200);
    expect((await request.post('/api/push/subscribe', { data: { kind: 'staff', subscription: sub } })).status()).toBe(401);

    // the daily job builds yesterday's report (and would notify staff devices)
    const cron = await request.get('/api/cron', { headers: { Authorization: 'Bearer local-cron-secret' } });
    expect(cron.status()).toBe(200);
    expect((await cron.json()).report_day).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const ctx = await desktopContext(browser);
    const admin = await ctx.newPage();
    await staffLogin(admin, OWNER, '/admin');
    await admin.waitForURL(/\/admin$/);
    await expect(admin.getByTestId('daily-report')).toBeVisible();
    await expect(admin.getByTestId('rating-avg')).toBeVisible();
    await admin.goto(`/admin/orders/${o.id}`);
    await expect(admin.getByText('★★★★★')).toBeVisible();
    await ctx.close();
  });
});
