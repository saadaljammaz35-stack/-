import { expect, test } from '@playwright/test';
import { desktopContext, mobileContext } from './helpers';

test('new design: preview link switches it on, the menu filter and ordering work, and the old design comes back', async ({ browser }) => {
  const ctx = await mobileContext(browser);
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto('/?design=new');
  await expect(page).toHaveURL(/\/$/); // the switch parameter is removed after setting the preference
  await expect(page.getByTestId('design-preview')).toBeVisible();
  await expect(page.getByTestId('tile-burger')).toBeVisible();
  await expect(page.locator('img[src*="studio%2Fhero"]').first()).toBeVisible();

  // segmented filter: only fries, then everything again
  await page.getByTestId('menu-tab-fries').click();
  await expect(page.getByTestId('product-samat-fries')).toBeVisible();
  await expect(page.getByTestId('product-samat-burger')).toHaveCount(0);
  await page.getByTestId('menu-tab-all').click();
  await expect(page.getByTestId('product-samat-burger')).toBeVisible();

  // order from the new design: the product page uses the new packaging photo, the bag count updates
  await page.getByTestId('product-samat-fries').click();
  await page.waitForURL(/\/p\/samat-fries/);
  await expect(page.locator('img[src*="studio%2Ffries"]').first()).toBeVisible();
  await page.getByTestId('add-to-cart').click();
  await expect(page.getByTestId('cart-count')).toHaveText('1');
  await page.goto('/cart');
  await expect(page.getByTestId('cart-line')).toHaveCount(1);

  // back to the current design
  await page.goto('/?design=old');
  await expect(page.getByTestId('design-preview')).toHaveCount(0);
  await expect(page.getByTestId('tile-burger')).toHaveCount(0);
  expect(errors).toEqual([]);
  await ctx.close();
});

test('visitors without the preview link still get the current design', async ({ browser }) => {
  const page = await (await desktopContext(browser)).newPage();
  await page.goto('/');
  await expect(page.getByTestId('design-preview')).toHaveCount(0);
  await expect(page.getByTestId('order-now')).toBeVisible();
  await expect(page.locator('[data-design="studio"]')).toHaveCount(0);
});
