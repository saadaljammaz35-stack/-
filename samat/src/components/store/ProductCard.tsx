'use client';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Flame } from 'lucide-react';
import { useI18n } from '@/lib/i18n/client';
import { formatMoney } from '@/lib/money';
import type { Product } from '@/lib/catalog-types';

export function ProductCard({ product: p, fallbackImage }: { product: Product; fallbackImage: string }) {
  const { t, locale } = useI18n();
  const Arrow = locale === 'ar' ? ArrowLeft : ArrowRight;
  const name = locale === 'ar' ? p.name_ar : p.name_en;
  const desc = locale === 'ar' ? p.description_ar : p.description_en;
  const content = (
    <article
      className={`group glass relative flex h-full flex-col overflow-hidden rounded-[1.6rem] p-4 transition-all duration-500 ease-[var(--ease-out-soft)] ${p.available ? 'hover:-translate-y-1 hover:shadow-lift' : 'opacity-60 grayscale-[0.6]'}`}
      data-testid={`product-${p.slug}`}
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-[1.2rem] bg-[radial-gradient(90%_90%_at_50%_70%,#efe3cc,#e6dcc8_60%,#d9c9ae)]">
        <Image
          src={p.image_url ?? fallbackImage}
          alt={name}
          fill
          sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw"
          className="object-contain p-3 drop-shadow-[0_18px_18px_rgba(47,35,28,0.28)] transition-transform duration-700 ease-[var(--ease-out-soft)] group-hover:scale-[1.06] group-hover:-rotate-2"
        />
        {p.is_featured && p.available && (
          <span className="chip absolute top-3 start-3 bg-espresso-800 text-cream-100"><Flame className="size-3.5" /> {t.menu.popular}</span>
        )}
        {!p.available && <span className="chip absolute top-3 start-3 bg-danger-500 text-white">{t.menu.unavailable}</span>}
      </div>
      <div className="flex flex-1 flex-col px-1 pt-4">
        <h4 className="text-lg font-bold">{name}</h4>
        {desc && <p className="mt-1 line-clamp-2 text-sm text-espresso-600">{desc}</p>}
        <div className="mt-auto flex items-center justify-between pt-4">
          <p className="num font-semibold"><span className="text-xs font-medium text-espresso-500">{t.menu.from} </span>{formatMoney(p.base_price, locale)}</p>
          {p.available && (
            <span className="btn btn-sm btn-primary transition-transform group-hover:translate-x-0">
              {p.builder === 'simple' ? t.menu.choose : t.menu.customize} <Arrow className="size-4" />
            </span>
          )}
        </div>
      </div>
    </article>
  );
  return p.available ? <Link href={`/p/${p.slug}`} className="block h-full rounded-[1.6rem]">{content}</Link> : content;
}
