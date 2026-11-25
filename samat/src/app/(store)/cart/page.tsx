import type { Metadata } from 'next';
import { CartView } from '@/components/cart/CartView';
import { getDict } from '@/lib/i18n/server';
import { getMenu } from '@/lib/catalog';
import { linesFromItems } from '@/lib/orders/reorder';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDict();
  return { title: t.cart.title };
}

/** Quick add-ons for the cart: ready-made items (fries, combos) that need no building. */
async function suggestions() {
  const menu = await getMenu();
  const simple = menu.products.filter((p) => p.builder === 'simple' && p.available).slice(0, 4);
  const out = [];
  for (const p of simple) {
    const { lines } = await linesFromItems([{ product_id: p.id, quantity: 1, selection: {} }]);
    if (lines[0]) out.push(lines[0]);
  }
  return out;
}

export default async function CartPage() {
  return <CartView suggestions={await suggestions().catch(() => [])} />;
}
