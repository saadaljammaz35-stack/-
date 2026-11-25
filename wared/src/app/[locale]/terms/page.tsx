import type { Metadata } from 'next';
import { LegalPage } from '@/components/site/LegalPage';
import { legal } from '@/content/legal';
import { resolveLocale } from '@/lib/i18n';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = await resolveLocale(params);
  return pageMetadata({ locale, path: '/terms', title: legal.terms[locale].title, description: legal.terms[locale].intro });
}

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await resolveLocale(params);
  return <LegalPage doc={legal.terms[locale]} />;
}
