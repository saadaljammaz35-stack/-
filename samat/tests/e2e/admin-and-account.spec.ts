import { expect, test } from '@playwright/test';
import pg from 'pg';
import { desktopContext, latestLink, mobileContext, staffLogin } from './helpers';

const OWNER = process.env.E2E_OWNER_EMAIL ?? 'owner@samat.local';
const DB = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

test.describe.serial('admin screens and customer account', () => {
  test('staff can also sign in with the link in the e-mail; a bad link is refused', async ({ browser }) => {
    const ctx = await desktopContext(browser);
    const page = await ctx.newPage();
    await page.goto('/admin/login?mode=code');
    const t0 = Date.now();
    await page.getByTestId('staff-email').fill(OWNER);
    await page.getByTestId('staff-submit').click();
    await expect(page.getByTestId('staff-code')).toBeVisible();
    await page.goto(await latestLink(OWNER, t0));
    await page.waitForURL(/\/admin$/);
    await expect(page.getByTestId('kpis')).toBeVisible();

    const other = await (await desktopContext(browser)).newPage();
    await other.goto('/auth/callback?code=not-a-real-code');
    await other.waitForURL(/\/admin\/login\?error=link/);
    await expect(other.getByTestId('staff-login-error')).toBeVisible();
    await ctx.close();
  });

  test('every admin screen renders for the owner without errors', async ({ browser }) => {
    const ctx = await desktopContext(browser);
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await staffLogin(page, OWNER, '/admin');
    await page.waitForURL(/\/admin$/);
    await expect(page.getByTestId('kpis')).toBeVisible();
    for (const path of ['/admin/orders', '/admin/pickup', '/admin/menu', '/admin/menu/ingredients', '/admin/menu/sauces', '/admin/inventory',
      '/admin/coupons', '/admin/loyalty', '/admin/staff', '/admin/settings', '/admin/notifications', '/admin/audit', '/admin/ai', '/kitchen', '/pickup-screen']) {
      const res = await page.goto(path);
      expect(res?.status(), path).toBeLessThan(400);
      await expect(page.locator('h1, [data-testid="kds"], [data-testid="pickup-screen"]').first()).toBeVisible();
    }
    expect(errors).toEqual([]);
    await ctx.close();
  });

  test('owner edits a price, pauses a product, records stock, creates a coupon, prints an invoice', async ({ browser }) => {
    const ctx = await desktopContext(browser);
    const page = await ctx.newPage();
    await staffLogin(page, OWNER, '/admin/menu');
    await page.waitForURL(/\/admin\/menu/);

    // product editor: change the fries price, save → storefront shows it
    await page.getByTestId('admin-product-samat-fries').click();
    await page.getByTestId('p-price').fill('10.50');
    await page.getByTestId('p-price').blur();
    await page.getByTestId('p-save').click();
    await expect(page.getByTestId('p-msg')).toContainText('تم الحفظ');
    const store = await ctx.newPage();
    await store.goto('/p/samat-fries');
    await expect(store.getByTestId('live-price').first()).toHaveAttribute('data-value', '1050');

    // temporary pause → sold out on the menu
    await page.getByTestId('p-is_available').uncheck();
    await page.getByTestId('p-save').click();
    await expect(page.getByTestId('p-msg')).toContainText('تم الحفظ');
    await store.goto('/');
    await expect(store.getByTestId('product-samat-fries')).toContainText('خلصان');
    await page.getByTestId('p-is_available').check();
    await page.getByTestId('p-save').click();
    await expect(page.getByTestId('p-msg')).toContainText('تم الحفظ');

    // inventory: a delivery of 25 portions of potatoes
    await page.goto('/admin/inventory');
    const row = page.getByTestId('inv-row-Potatoes');
    const before = Number(await row.getByTestId('inv-available').innerText());
    await row.getByTestId('inv-move').click();
    await page.getByTestId('inv-move-type').selectOption('purchase');
    await page.getByTestId('inv-move-qty').fill('25');
    await page.getByTestId('inv-move-apply').click();
    await expect(page.getByTestId('inv-row-Potatoes').getByTestId('inv-available')).toHaveText(String(before + 25));

    // coupon → valid at checkout
    const code = `E2E${Date.now() % 100000}`;
    await page.goto('/admin/coupons');
    await page.getByTestId('new-coupon').click();
    await page.getByTestId('coupon-code').fill(code);
    await page.getByTestId('coupon-title-ar').fill('خصم اختبار');
    await page.getByTestId('coupon-title-en').fill('Test discount');
    await page.getByTestId('coupon-value').fill('20');
    await page.getByTestId('coupon-save').click();
    await expect(page.getByText(code)).toBeVisible();
    await store.goto('/p/samat-fries');
    await store.getByTestId('add-to-cart').click();
    await store.goto('/checkout');
    await store.getByTestId('coupon').fill(code);
    await store.getByTestId('apply-coupon').click();
    await expect(store.getByTestId('coupon-ok')).toBeVisible();

    // an accepted order prints as a simplified tax invoice (80mm) with a ZATCA QR once a VAT number is set
    const c = new pg.Client({ connectionString: DB });
    await c.connect();
    await c.query(`update store_settings set vat_number = '300000000000003', legal_name = 'مؤسسة سماط للأغذية' where id = 1`);
    const { rows } = await c.query(`select order_id from invoices order by issued_at desc limit 1`);
    await c.end();
    await page.goto(`/admin/print/${rows[0].order_id}?format=80mm`);
    await expect(page.getByTestId('receipt')).toContainText('فاتورة ضريبية مبسطة');
    await expect(page.getByTestId('receipt').locator('svg')).toBeVisible();
    await page.goto(`/admin/print/${rows[0].order_id}?format=58mm&kind=kitchen`);
    await expect(page.getByTestId('receipt')).toContainText('ورقة المطبخ');
    await ctx.close();
  });

  test('customer signs in with phone OTP and sees orders and points', async ({ browser }) => {
    const ctx = await mobileContext(browser);
    const page = await ctx.newPage();
    await page.goto('/account');
    await page.getByTestId('login-phone').fill('0500000001'); // local test number → fixed code (supabase/config.toml)
    await page.getByTestId('login-submit').click();
    await page.getByTestId('login-code').fill('123456');
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('loyalty-card')).toBeVisible();
    await expect(page.getByTestId('points-balance')).toContainText('0');
    await ctx.close();
  });
});
