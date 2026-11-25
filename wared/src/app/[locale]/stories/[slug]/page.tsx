import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Cover, EpisodeList, FallbackNote, SectionHeader } from '@/components/site/blocks';
import { RichText } from '@/components/ui/RichText';
import { getArticleBySlug } from '@/lib/data/public';
import { formatDate, readingMinutes } from '@/lib/format';
import { getDictionary, resolveLocale, t } from '@/lib/i18n';
import { isFallback, pick } from '@/lib/i18n/config';
import { articleJsonLd, breadcrumbJsonLd, jsonLdString, pageMetadata } from '@/lib/seo';

export const revalidate = 60;

export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) return pageMetadata({ locale, path: `/stories/${slug}`, noIndex: true });
  return pageMetadata({
    locale,
    path: `/stories/${slug}`,
    title: pick(locale, article.title, article.titleEn),
    description: pick(locale, article.dek, article.dekEn) ?? undefined,
    image: article.cover?.url,
    type: 'article',
    publishedTime: article.publishedAt,
  });
}

export default async function ArticlePage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const locale = await resolveLocale(params);
  const { slug } = await params;
  const dict = getDictionary(locale);
  const article = await getArticleBySlug(slug);
  if (!article) notFound();
  const fallback = isFallback(locale, article.bodyEn);
  const body = fallback ? article.body : (article.bodyEn ?? article.body);
  const title = pick(locale, article.title, article.titleEn);
  const minutes = article.readingMinutes ?? readingMinutes(body);

  return (
    <article>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdString([
            articleJsonLd(article, locale),
            breadcrumbJsonLd(locale, [
              { name: dict.nav.stories, path: '/stories' },
              { name: title, path: `/stories/${article.slug}` },
            ]),
          ]),
        }}
      />
      <header className="container-page pb-12 pt-14 md:pb-16 md:pt-24">
        <p className="eyebrow mb-6">
          {dict.stories.kinds[article.kind]}
          {article.category ? ` · ${pick(locale, article.category.name, article.category.nameEn)}` : ''}
        </p>
        <FallbackNote show={fallback} dict={dict} />
        <h1 className="display max-w-5xl text-[clamp(2.5rem,7vw,6rem)]" lang={isFallback(locale, article.titleEn) ? 'ar' : undefined}>
          {title}
        </h1>
        {article.dek && <p className="mt-7 max-w-3xl text-xl leading-9 text-muted md:text-2xl md:leading-[1.8]">{pick(locale, article.dek, article.dekEn)}</p>}
        <p className="mt-8 text-sm text-muted">
          {[article.authorName ? t(dict.common.by, { name: article.authorName }) : null, formatDate(article.publishedAt, locale), t(dict.common.readingTime, { n: minutes })]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </header>
      {article.cover && (
        <div className="container-page">
          <Cover media={article.cover} alt={pick(locale, article.cover.alt, article.cover.altEn) ?? ''} priority sizes="(min-width: 1312px) 1232px, 100vw" className="aspect-[16/9] rounded-[28px]" />
        </div>
      )}
      <div className="container-page mt-14 md:mt-20">
        <div className="mx-auto max-w-[40rem]">
          <RichText text={body} lang={fallback ? 'ar' : undefined} dir={fallback ? 'rtl' : undefined} />
        </div>
      </div>
      {article.relatedEpisode && (
        <section className="container-page mt-28" aria-labelledby="related-heading">
          <SectionHeader id="related-heading" title={dict.common.relatedEpisode} />
          <EpisodeList episodes={[article.relatedEpisode]} locale={locale} dict={dict} />
        </section>
      )}
    </article>
  );
}
