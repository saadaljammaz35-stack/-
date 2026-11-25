import type { Metadata } from 'next';
import { EmptyState, GuestTile, PageHeader } from '@/components/site/blocks';
import { getGuests } from '@/lib/data/public';
import { getDictionary, resolveLocale } from '@/lib/i18n';
import { pageMetadata } from '@/lib/seo';

export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const dict = getDictionary(locale);
  return pageMetadata({ locale, path: '/guests', title: dict.guests.title, description: dict.guests.intro });
}

export default async function GuestsPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await resolveLocale(params);
  const dict = getDictionary(locale);
  const guests = await getGuests(120);
  return (
    <>
      <PageHeader title={dict.guests.title} intro={dict.guests.intro} />
      <div className="container-page">
        {guests.length === 0 ? (
          <EmptyState title={dict.guests.empty} />
        ) : (
          <div className="grid grid-cols-2 gap-x-5 gap-y-12 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-8">
            {guests.map((guest) => (
              <GuestTile key={guest.id} guest={guest} locale={locale} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
