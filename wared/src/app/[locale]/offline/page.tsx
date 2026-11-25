import type { Metadata } from 'next';
import { PageHeader } from '@/components/site/blocks';
import { getDictionary, resolveLocale } from '@/lib/i18n';

export const metadata: Metadata = { robots: { index: false } };

export default async function OfflinePage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await resolveLocale(params);
  const dict = getDictionary(locale);
  return <PageHeader title={dict.pages.offline.title} intro={dict.pages.offline.body} />;
}
