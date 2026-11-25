import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Cover, EpisodeList, FallbackNote, SectionHeader } from '@/components/site/blocks';
import { RichText } from '@/components/ui/RichText';
import { getGuestBySlug } from '@/lib/data/public';
import { getDictionary, resolveLocale } from '@/lib/i18n';
import { isFallback, pick } from '@/lib/i18n/config';
import { jsonLdString, pageMetadata, personJsonLd } from '@/lib/seo';

export const revalidate = 60;

export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const { slug } = await params;
  const guest = await getGuestBySlug(slug);
  if (!guest) return pageMetadata({ locale, path: `/guests/${slug}`, noIndex: true });
  return pageMetadata({
    locale,
    path: `/guests/${slug}`,
    title: pick(locale, guest.name, guest.nameEn),
    description: pick(locale, guest.headline, guest.headlineEn) ?? undefined,
    image: guest.photo?.url,
  });
}

export default async function GuestPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const locale = await resolveLocale(params);
  const { slug } = await params;
  const dict = getDictionary(locale);
  const guest = await getGuestBySlug(slug);
  if (!guest) notFound();
  const bio = pick(locale, guest.bio, guest.bioEn);
  const links = [
    guest.websiteUrl ? { label: new URL(guest.websiteUrl).host, href: guest.websiteUrl } : null,
    guest.xHandle ? { label: `X @${guest.xHandle}`, href: `https://x.com/${guest.xHandle}` } : null,
    guest.instagramHandle ? { label: `Instagram @${guest.instagramHandle}`, href: `https://instagram.com/${guest.instagramHandle}` } : null,
    guest.linkedinUrl ? { label: 'LinkedIn', href: guest.linkedinUrl } : null,
  ].filter((l): l is { label: string; href: string } => Boolean(l));

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(personJsonLd(guest, locale)) }} />
      <header className="container-page grid gap-10 pb-16 pt-12 md:grid-cols-[1fr_1.4fr] md:gap-16 md:pt-20">
        <Cover media={guest.photo} alt={pick(locale, guest.name, guest.nameEn)} priority sizes="(min-width: 768px) 35vw, 100vw" className="aspect-[4/5] rounded-[28px]" />
        <div className="flex flex-col justify-end">
          <p className="eyebrow mb-5">{dict.guests.title}</p>
          <FallbackNote show={isFallback(locale, guest.nameEn)} dict={dict} />
          <h1 className="display text-[clamp(2.75rem,8vw,6.5rem)]">{pick(locale, guest.name, guest.nameEn)}</h1>
          {guest.headline && <p className="mt-6 text-xl leading-9 text-muted">{pick(locale, guest.headline, guest.headlineEn)}</p>}
          {bio && <RichText text={bio} className="prose-wared mt-8" />}
          {links.length > 0 && (
            <ul className="mt-8 flex flex-wrap gap-3" aria-label={dict.guests.links}>
              {links.map((link) => (
                <li key={link.href}>
                  <a href={link.href} target="_blank" rel="noopener noreferrer" className="btn btn-ghost" dir="ltr">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </header>
      {guest.episodes.length > 0 && (
        <section className="container-page mt-12" aria-labelledby="appearances">
          <SectionHeader id="appearances" title={dict.guests.appearances} />
          <EpisodeList episodes={guest.episodes} locale={locale} dict={dict} />
        </section>
      )}
    </>
  );
}
