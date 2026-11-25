import Link from 'next/link';
import { Plus } from 'lucide-react';
import { requireStaffPage } from '@/lib/auth/staff';
import { userDb } from '@/lib/supabase/server';
import { adminDb } from '@/lib/supabase/admin';
import { getLocale } from '@/lib/i18n/server';
import { adminDicts } from '@/lib/i18n/admin';
import { formatMoney } from '@/lib/money';
import { PageHeader } from '@/components/admin/ui';

export default async function MenuPage() {
  await requireStaffPage('menu.manage', '/admin/menu');
  const locale = await getLocale();
  const a = adminDicts[locale];
  const db = await userDb();
  const [{ data: cats }, { data: products }, avail] = await Promise.all([
    db.from('categories').select('id, kind, name_ar, name_en').order('sort_order'),
    db.from('products').select('id, category_id, slug, name_ar, name_en, image_url, base_price, is_active, is_available, builder, sort_order').is('deleted_at', null).order('sort_order'),
    adminDb().rpc('menu_availability'),
  ]);
  const av = (avail.data ?? { products: {} }) as { products: Record<string, boolean> };
  const n = (r: { name_ar: string; name_en: string }) => (locale === 'ar' ? r.name_ar : r.name_en);
  return (
    <div>
      <PageHeader title={a.menu.products} actions={<Link href="/admin/menu/new" className="btn btn-primary" data-testid="new-product"><Plus className="size-4" /> {a.menu.newProduct}</Link>} />
      {(cats ?? []).map((c) => (
        <section key={c.id} className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-bold">{n(c)}</h2>
            <Link href={`/admin/menu/new?category=${c.id}`} className="btn btn-sm btn-ghost"><Plus className="size-4" /> {a.menu.newProduct}</Link>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {(products ?? []).filter((p) => p.category_id === c.id).map((p) => (
              <li key={p.id}>
                <Link href={`/admin/menu/${p.id}`} className="glass flex items-center gap-3 rounded-3xl p-3 transition hover:shadow-lift" data-testid={`admin-product-${p.slug}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.image_url ?? `/media/menu/${c.kind}.webp`} alt="" className="size-16 rounded-2xl bg-sand-300/50 object-contain p-1" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{n(p)}</p>
                    <p className="num text-sm text-espresso-600">{p.base_price == null ? a.menu.notPriced : formatMoney(p.base_price, locale)}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <span className={`chip ${p.is_active ? 'bg-ok-500/10 text-ok-500' : 'bg-sand-300 text-espresso-600'}`}>{p.is_active ? a.menu.active : '—'}</span>
                      {!p.is_available && <span className="chip bg-warn-500/15">{a.menu.available} ✕</span>}
                      {p.is_active && av.products[p.id] === false && <span className="chip bg-danger-500/10 text-danger-500">{a.dash.unavailable}</span>}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
