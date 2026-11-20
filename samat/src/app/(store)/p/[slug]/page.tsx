import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { getProductBySlug, getStoreState } from '@/lib/catalog';
import { getLocale } from '@/lib/i18n/server';
import { Builder } from '@/components/builder/Builder';
import { currentCustomer } from '@/lib/auth/customer';

const FALLBACK = { burger: '/media/products/burger.webp', shawarma: '/media/products/shawarma.webp', fries: '/media/products/fries.webp' } as const;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const [found, locale] = await Promise.all([getProductBySlug(slug), getLocale()]);
  if (!found) return {};
  const p = found.product;
  return { title: locale === 'ar' ? p.name_ar : p.name_en, description: (locale === 'ar' ? p.description_ar : p.description_en) ?? undefined };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [found, state, customer] = await Promise.all([getProductBySlug(slug), getStoreState(), currentCustomer()]);
  if (!found) notFound();
  return (
    <Suspense>
      <Builder product={found.product} availability={found.availability} state={state} fallbackImage={FALLBACK[found.product.category_kind]} signedIn={Boolean(customer)} />
    </Suspense>
  );
}
