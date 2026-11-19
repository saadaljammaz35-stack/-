import { createHash, randomBytes } from 'node:crypto';
import { expect, test } from '@playwright/test';
import pg from 'pg';
import { desktopContext, staffLogin } from './helpers';

const OWNER = process.env.E2E_OWNER_EMAIL ?? 'owner@samat.local';
const DB = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const PASSWORD = `Samat-${randomBytes(6).toString('hex')}`;

/** What the owner's first link looks like when it is issued outside the app (as at launch). */
async function seedLink(email: string): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  const c = new pg.Client({ connectionString: DB });
  await c.connect();
  await c.query('insert into public.staff_access_links (email, token_hash) values ($1, $2)', [email, createHash('sha256').update(token).digest('hex')]);
  await c.end();
  return `/admin/setup?token=${token}`;
}

test.describe.serial('staff passwords via single-use links', () => {
  test('owner sets a password from a link, the link works once, password sign-in works', async ({ browser }) => {
    const link = await seedLink(OWNER);
    const ctx = await desktopContext(browser);
    const page = await ctx.newPage();
    await page.goto(link);
    await page.getByTestId('setup-password').fill(PASSWORD);
    await page.getByTestId('setup-confirm').fill(PASSWORD + 'x');
    await page.getByTestId('setup-submit').click();
    await expect(page.getByTestId('setup-error')).toBeVisible();
    await page.getByTestId('setup-confirm').fill(PASSWORD);
    await page.getByTestId('setup-submit').click();
    await page.waitForURL(/\/admin$/);
    await expect(page.getByTestId('kpis')).toBeVisible();

    // the same link is refused the second time
    const again = await (await desktopContext(browser)).newPage();
    await again.goto(link);
    await again.getByTestId('setup-password').fill(PASSWORD);
    await again.getByTestId('setup-confirm').fill(PASSWORD);
    await again.getByTestId('setup-submit').click();
    await expect(again.getByTestId('setup-error')).toBeVisible();

    // password sign-in (the default on the login page); a wrong password is refused
    const fresh = await (await desktopContext(browser)).newPage();
    await fresh.goto('/admin/login');
    await fresh.getByTestId('staff-email').fill(OWNER);
    await fresh.getByTestId('staff-password').fill('not-the-password');
    await fresh.getByTestId('staff-submit').click();
    await expect(fresh.getByTestId('staff-login-error')).toBeVisible();
    await fresh.getByTestId('staff-password').fill(PASSWORD);
    await fresh.getByTestId('staff-submit').click();
    await fresh.waitForURL(/\/admin$/);
    await ctx.close();
  });

  test('owner invites kitchen staff and shares a link; they choose a password and land on the kitchen screen', async ({ browser }) => {
    const kitchen = `kitchen-link-${Date.now()}@samat.local`;
    const ctx = await desktopContext(browser);
    const page = await ctx.newPage();
    await staffLogin(page, OWNER, '/admin/staff');
    await page.waitForURL(/\/admin\/staff$/);
    await page.getByTestId('invite-email').fill(kitchen);
    await page.getByTestId('invite-role').selectOption('kitchen');
    await page.getByTestId('invite-submit').click();
    const row = page.locator('li', { hasText: kitchen });
    await row.getByTestId('staff-link').click();
    const url = await page.getByTestId('staff-link-url').inputValue();
    expect(url).toContain('/admin/setup?token=');

    const staff = await (await desktopContext(browser)).newPage();
    await staff.goto(new URL(url).pathname + new URL(url).search);
    await staff.getByTestId('setup-password').fill(PASSWORD);
    await staff.getByTestId('setup-confirm').fill(PASSWORD);
    await staff.getByTestId('setup-submit').click();
    await staff.waitForURL(/\/kitchen$/);
    await expect(staff.getByTestId('kds')).toBeVisible();

    // a link can only be made for staff or invitees
    const res = await page.request.post('/api/admin/access-links', { data: { email: 'stranger@example.com' } });
    expect(res.status()).toBe(404);
    // and not without signing in
    const anon = await (await desktopContext(browser)).newPage();
    expect((await anon.request.post('/api/admin/access-links', { data: { email: kitchen } })).status()).toBe(401);
    await ctx.close();
  });
});
