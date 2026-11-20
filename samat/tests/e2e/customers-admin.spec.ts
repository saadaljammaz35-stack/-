import { expect, test } from '@playwright/test';
import pg from 'pg';
import { desktopContext, latestSmsCode, mobileContext, staffLogin } from './helpers';

const OWNER = process.env.E2E_OWNER_EMAIL ?? 'owner@samat.local';
const DB = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const q = async (sql: string, args: unknown[] = []) => {
  const c = new pg.Client({ connectionString: DB });
  await c.connect();
  try { return (await c.query(sql, args)).rows; } finally { await c.end(); }
};

test('new customer gets the welcome points; owner finds them in Customers and adds points', async ({ browser }) => {
  await q("delete from public.rate_limits where key like 'otp:%'");
  await q('update public.store_settings set loyalty_enabled = true, loyalty_welcome_points = 30 where id = 1');
  try {
    // a new customer signs up with an SMS code
    const local = `05${String(Date.now()).slice(-8)}`;
    const phone = `+966${local.slice(1)}`;
    const cust = await (await mobileContext(browser)).newPage();
    await cust.goto('/account');
    const t0 = Date.now();
    await cust.getByTestId('login-phone').fill(local);
    await cust.getByTestId('login-submit').click();
    await cust.getByTestId('login-code').fill(await latestSmsCode(phone, t0));
    await cust.getByTestId('login-submit').click();
    await expect(cust.getByTestId('points-balance')).toContainText('30');
    // first visit asks for the name; after saving, the card goes away
    const name = `عميل ${local.slice(-8)}`;
    await expect(cust.getByTestId('complete-profile')).toBeVisible();
    await cust.getByTestId('profile-name').fill(name);
    await cust.getByTestId('profile-save').click();
    await expect(cust.getByTestId('complete-profile')).toHaveCount(0);
    await expect(cust.getByText(name)).toBeVisible();

    // the owner finds them and adds 50 points
    const ctx = await desktopContext(browser);
    const page = await ctx.newPage();
    await staffLogin(page, OWNER, '/admin/customers');
    await page.waitForURL(/\/admin\/customers/);
    await page.getByTestId('customers-search').fill(name);
    await page.getByTestId('customers-search').press('Enter');
    await expect(page.getByTestId('customer-row')).toHaveCount(1);
    await expect(page.getByTestId('customer-balance')).toHaveText('30');
    await page.getByTestId('customer-points').click();
    await page.getByRole('button', { name: '50', exact: true }).click();
    await page.getByTestId('points-add').click();
    await expect(page.getByTestId('points-msg')).toContainText('80');
    await expect(page.getByTestId('customer-balance')).toHaveText('80');

    // the customer sees it, and the export works
    await cust.reload();
    await expect(cust.getByTestId('points-balance')).toContainText('80');
    const csv = await page.request.get('/api/admin/customers/export');
    expect(csv.headers()['content-type']).toContain('text/csv');
    expect(await csv.text()).toContain(phone);
    // signing in again does not give the welcome points twice
    expect((await q("select count(*)::int as n from public.loyalty_transactions t join public.profiles p on p.id = t.customer_id where p.phone = $1 and t.note = 'Welcome points'", [phone]))[0].n).toBe(1);
    await ctx.close();
  } finally {
    await q('update public.store_settings set loyalty_welcome_points = 0 where id = 1');
  }
});

test('customers page and export need loyalty permission', async ({ browser }) => {
  const anon = await (await desktopContext(browser)).newPage();
  expect((await anon.request.get('/api/admin/customers/export')).status()).toBe(401);
});
