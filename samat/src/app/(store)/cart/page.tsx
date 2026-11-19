import type { Metadata } from 'next';
import { CartView } from '@/components/cart/CartView';
import { getDict } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDict();
  return { title: t.cart.title };
}

export default function CartPage() {
  return <CartView />;
}
