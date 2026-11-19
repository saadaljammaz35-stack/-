import { expect, test } from '@playwright/test';
import pg from 'pg';
import { desktopContext, mobileContext, priceOf, receiptPng, staffLogin } from './helpers';

// One restaurant day, end to end: a customer orders on an iPhone and pays by bank transfer, the
// owner approves, the kitchen prepares, the counter hands over with the pickup code, and the
// customer orders again. Runs against the local stack (Next.js + Supabase + Mailpit).

const OWNER = process.env.E2E_OWNER_EMAIL ?? 'owner@samat.local';
const KITCHEN = `kitchen-${Date.now()}@samat.local`;
const shared: { track?: string; pickupCode?: string; orderNumber?: string } = {};

test.beforeAll(async () => {
  // start every run from an open store (a previously interrupted run may have paused it)
  const c = new pg.Client({ connectionString: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' });
  await c.connect();
  await c.query('update store_settings set accepting_orders = true, busy_mode = false, max_active_orders = null where id = 1');
  await c.end();
});

test.describe.serial('SAMAT end-to-end', () => {
  test('customer: language, burger & shawarma builders, cart, checkout, bank transfer', async ({ browser }) => {
    const ctx = await mobileContext(browser);
    const page = await ctx.newPage();
    await page.goto('/');
    await expect(page.locator('h1')).toHaveText('وش تشتهي اليوم؟');
    await page.getByTestId('lang-toggle').click();
    await expect(page.locator('h1')).toHaveText('What are you craving today?');
    await page.getByTestId('lang-toggle').click();
    await expect(page.locator('h1')).toHaveText('وش تشتهي اليوم؟');

    // ---- burger: the bun is locked, toppings change the picture and the price
    await page.goto('/p/samat-burger');
    await expect(page.getByTestId('bun-locked')).toBeVisible();
    await expect(page.getByTestId('toggle-brioche-bun')).toHaveCount(0);
    const base = await priceOf(page);
    const layersBefore = await page.getByTestId('stage').locator('img').count();
    await page.getByTestId('toggle-mushrooms').click();
    await page.getByTestId('step-beef-patty').getByRole('button', { name: /^\+/ }).click();
    await page.getByTestId('step-red-onion').getByRole('button', { name: /^−/ }).click();
    await expect(page.getByTestId('ing-red-onion')).toHaveAttribute('data-qty', '0');
    await expect.poll(() => priceOf(page)).toBe(base + 300 + 700); // demo seed: mushrooms 3.00, extra patty 7.00
    await expect.poll(() => page.getByTestId('stage').locator('img').count()).toBe(layersBefore + 1); // +mushroom +patty −onion
    await expect(page.getByTestId('summary')).toContainText('بدون بصل أحمر');
    await page.getByTestId('add-to-cart').click();
    await expect(page.getByTestId('added-toast')).toBeVisible();

    // ---- shawarma: exactly one bread, white bread chosen, extra hot sauce
    await page.goto('/p/samat-shawarma');
    await expect(page.getByTestId('bread-choice')).toBeVisible();
    await page.getByTestId('bread-white-bread').check({ force: true });
    await page.getByTestId('sauce-spicy').getByRole('button').click();
    const shawarmaPrice = await priceOf(page);
    expect(shawarmaPrice).toBe(1200 + 200);
    await page.getByTestId('add-to-cart').click();
    await expect(page.getByTestId('cart-count')).toHaveText('2');

    // ---- cart: server-side quote matches the preview
    await page.goto('/cart');
    await expect(page.getByTestId('cart-line')).toHaveCount(2);
    await expect(page.getByTestId('cart-total')).toContainText(((base + 1000 + shawarmaPrice) / 100).toFixed(2));
    await page.getByTestId('go-checkout').click();

    // ---- checkout as a guest
    await page.getByTestId('name').fill('عميل الاختبار');
    await page.getByTestId('phone').fill('0551234567');
    await page.getByTestId('email').fill('customer-e2e@samat.local');
    await page.getByTestId('place-order').click();
    await page.waitForURL(/\/pay\//);

    // ---- bank transfer: IBAN shown, receipt uploaded
    await expect(page.getByTestId('bank-transfer')).toBeVisible();
    await expect(page.getByTestId('iban')).toContainText('SA25');
    await page.getByTestId('receipt-input').setInputFiles({ name: 'receipt.png', mimeType: 'image/png', buffer: receiptPng() });
    await page.getByTestId('send-receipt').click();
    await page.waitForURL(/\/t\//);
    shared.track = page.url().split('/t/')[1];
    await expect(page.getByTestId('status-title')).toHaveText('وصلنا طلبك وإيصال التحويل');
    await expect(page.getByTestId('pickup')).toBeVisible();
    shared.pickupCode = (await page.getByTestId('pickup-code').innerText()).trim();
    await expect(page.getByTestId('pickup').locator('svg')).toBeVisible(); // QR
    await ctx.close();
  });

  test('owner: sees the order with its receipt, must confirm the transfer, accepts, invites kitchen staff', async ({ browser }) => {
    const ctx = await desktopContext(browser);
    const page = await ctx.newPage();
    await staffLogin(page, OWNER, '/admin/orders');
    await page.waitForURL(/\/admin\/orders/);
    const card = page.locator('[data-testid^="order-"]').filter({ hasText: 'عميل الاختبار' }).first();
    await expect(card).toBeVisible();
    await card.getByTestId('review-receipt').click();
    await expect(page.getByTestId('receipt-link')).toBeVisible();
    await expect(page.getByTestId('accept')).toBeDisabled();
    await page.getByTestId('confirm-transfer').check();
    await page.getByTestId('accept').click();
    await expect(page.locator('[data-status="accepted"]').first()).toBeVisible();
    shared.orderNumber = (await page.locator('h1').innerText()).match(/#(\d+)/)?.[1];

    await page.goto('/admin/staff');
    await page.getByTestId('invite-email').fill(KITCHEN);
    await page.getByTestId('invite-role').selectOption('kitchen');
    await page.getByTestId('invite-submit').click();
    await expect(page.getByTestId('staff-msg')).toBeVisible();
    await ctx.close();
  });

  test('kitchen: invited staff signs in, sees only kitchen tools, prepares the order', async ({ browser }) => {
    const ctx = await desktopContext(browser);
    const page = await ctx.newPage();
    await staffLogin(page, KITCHEN, '/kitchen');
    await page.waitForURL(/\/kitchen/);
    const ticket = page.getByTestId(`kds-${shared.orderNumber}`);
    await expect(ticket).toBeVisible();
    await expect(ticket).toContainText('بدون');
    await expect(ticket).toContainText('خبز أبيض');
    await expect(ticket.getByTestId('kds-timer')).toHaveText(/\d\d:\d\d/);
    await ticket.getByTestId('kds-start').click();
    await expect(page.getByTestId(`kds-${shared.orderNumber}`).getByTestId('kds-ready')).toBeVisible();
    await page.getByTestId(`kds-${shared.orderNumber}`).getByTestId('kds-ready').click();
    await expect(page.getByTestId(`kds-${shared.orderNumber}`).getByTestId('kds-delivered')).toBeVisible();

    // no permission for the menu: the server redirects to 403
    await page.goto('/admin/menu');
    await page.waitForURL(/\/admin\/forbidden/);
    const res = await page.request.post('/api/admin/menu/products', { data: { action: 'delete', id: '00000000-0000-0000-0000-000000000000' } });
    expect(res.status()).toBe(403);
    await ctx.close();
  });

  test('customer: tracking shows ready; counter hands over once with the pickup code', async ({ browser }) => {
    const cctx = await mobileContext(browser);
    const cpage = await cctx.newPage();
    await cpage.goto(`/t/${shared.track}`);
    await expect(cpage.getByTestId('status-title')).toHaveText('طلبك جاهز يا هلا');

    const sctx = await desktopContext(browser);
    const spage = await sctx.newPage();
    await staffLogin(spage, OWNER, '/admin/pickup');
    await spage.waitForURL(/\/admin\/pickup/);
    await spage.getByTestId('pickup-input').fill(shared.pickupCode!);
    await spage.getByTestId('pickup-lookup').click();
    await spage.getByTestId('pickup-deliver').click();
    await expect(spage.getByTestId('pickup-msg')).toContainText(`#${shared.orderNumber}`);
    // reusing the same code is refused and says who handed it over
    await spage.getByTestId('pickup-input').fill(shared.pickupCode!);
    await spage.getByTestId('pickup-lookup').click();
    await expect(spage.getByTestId('pickup-deliver')).toHaveCount(0);
    const again = await spage.request.post('/api/admin/pickup', { data: { ref: shared.pickupCode, action: 'deliver' } });
    expect(await again.json()).toMatchObject({ ok: false, reason: 'already_delivered' });
    await sctx.close();

    await cpage.reload();
    await expect(cpage.getByTestId('status-title')).toHaveText('بالعافية عليك!');
    // order again → current prices in the cart
    await cpage.getByTestId('reorder').click();
    await cpage.waitForURL(/\/cart/);
    await expect(cpage.getByTestId('cart-line')).toHaveCount(2);
    await expect(cpage.getByTestId('reorder-notice')).toBeVisible();
    await cctx.close();
  });

  test('owner: pausing orders blocks checkout, reopening restores it', async ({ browser }) => {
    const sctx = await desktopContext(browser);
    const spage = await sctx.newPage();
    await staffLogin(spage, OWNER, '/admin');
    await spage.waitForURL(/\/admin$/);
    await spage.getByTestId('pause-orders').click();
    await expect(spage.getByTestId('ordering-state')).toHaveText('الطلبات موقفة');

    const cctx = await mobileContext(browser);
    const cpage = await cctx.newPage();
    await cpage.goto('/');
    await expect(cpage.getByTestId('store-message')).toBeVisible();
    await cpage.goto('/p/samat-fries');
    await cpage.getByTestId('add-to-cart').click();
    await cpage.goto('/checkout');
    await expect(cpage.getByText('ما نقدر نستقبل طلبات الحين')).toBeVisible();
    await expect(cpage.getByTestId('place-order')).toBeDisabled();

    await spage.getByTestId('resume-orders').click();
    await expect(spage.getByTestId('ordering-state')).toHaveText('نستقبل الطلبات');
    await cpage.reload();
    await cpage.getByTestId('name').fill('عميل البطاقة');
    await cpage.getByTestId('phone').fill('0559876543');
    await expect(cpage.getByTestId('place-order')).toBeEnabled();
    await cpage.getByTestId('place-order').click();
    await cpage.waitForURL(/\/pay\//);

    // card path (local payment simulator): a declined attempt, then an authorisation
    await cpage.getByTestId('tab-card').click();
    await cpage.getByTestId('sim-failed').click();
    await expect(cpage.getByTestId('payment-failed')).toBeVisible();
    await cpage.getByTestId('sim-authorized').click();
    await cpage.waitForURL(/\/t\//);
    await expect(cpage.getByTestId('status-title')).toHaveText('طلبك وصلنا يا هلا!');

    // accepting an authorised payment captures it first
    await spage.goto('/admin/orders');
    const card = spage.locator('[data-testid^="order-"]').filter({ hasText: 'عميل البطاقة' }).first();
    await card.getByTestId('accept').click();
    await expect(card.locator('[data-status="paid"]')).toBeVisible();
    await sctx.close();
    await cctx.close();
  });
});
