import type { Metadata } from 'next';
import { TokenAction } from '@/components/site/TokenAction';
import { getDictionary, resolveLocale } from '@/lib/i18n';

export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: 'no-referrer' };

export default async function NewsletterPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ token?: string; status?: string }> }) {
  const locale = await resolveLocale(params);
  const { token = '', status } = await searchParams;
  return <TokenAction kind="unsubscribe" locale={locale} dict={getDictionary(locale)} token={token.slice(0, 200)} status={status} />;
}
