'use client';
import Image from 'next/image';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Heart, ShoppingBag, Trash2 } from 'lucide-react';
import { useI18n } from '@/lib/i18n/client';
import { cart, type CartLine } from '@/components/cart/cart-store';

export interface Fav { id: string; name: string; product_name_ar: string; product_name_en: string; image_url: string | null }

/** The customer's saved builds: one tap to the cart (priced with today's menu). */
export function FavoritesList({ items }: { items: Fav[] }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [gone, setGone] = useState<string[]>([]);
  const list = items.filter((f) => !gone.includes(f.id));
  if (!list.length) return null;
  return (
    <section data-testid="favorites">
      <h2 className="mb-3 flex items-center gap-2 text-xl font-bold"><Heart className="size-5 text-terracotta-500" /> {t.account.favorites}</h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {list.map((f) => (
          <li key={f.id} className="glass flex items-center gap-3 rounded-3xl p-3">
            {f.image_url && <Image src={f.image_url} alt="" width={64} height={64} className="size-14 object-contain" />}
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{f.name}</p>
              <p className="truncate text-xs text-espresso-500">{locale === 'ar' ? f.product_name_ar : f.product_name_en}</p>
            </div>
            <button type="button" className="btn btn-sm btn-primary" disabled={busy === f.id} data-testid="fav-to-cart" onClick={async () => {
              setBusy(f.id);
              const res = await fetch('/api/favorites/cart', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: f.id }) });
              const json = (await res.json()) as { lines?: Omit<CartLine, 'key' | 'addedAt'>[]; changed?: boolean };
              setBusy(null);
              if (!res.ok || !json.lines?.length) return;
              json.lines.forEach((l) => cart.add(l));
              sessionStorage.setItem('samat_reorder_msg', json.changed ? t.account.reorderChanged : t.account.reorderDone);
              router.push('/cart');
            }}><ShoppingBag className="size-4" /> {t.account.favOrder}</button>
            <button type="button" className="p-1 text-espresso-400 hover:text-danger-500" aria-label={t.account.favDelete} onClick={async () => {
              await fetch(`/api/favorites?id=${f.id}`, { method: 'DELETE' });
              setGone((g) => [...g, f.id]);
            }}><Trash2 className="size-4" /></button>
          </li>
        ))}
      </ul>
    </section>
  );
}
