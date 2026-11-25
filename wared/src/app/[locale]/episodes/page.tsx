import type { Metadata } from 'next';
import Link from 'next/link';
import { EmptyState, EpisodeList, PageHeader, Pagination } from '@/components/site/blocks';
import { getEpisodes, getPrograms } from '@/lib/data/public';
import { getDictionary, resolveLocale } from '@/lib/i18n';
import { localePath, pick } from '@/lib/i18n/config';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const dict = getDictionary(locale);
  return pageMetadata({ locale, path: '/episodes', title: dict.episodes.title, description: dict.episodes.intro });
}

export default async function EpisodesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ page?: string; program?: string }> }) {
  const locale = await resolveLocale(params);
  const dict = getDictionary(locale);
  const sp = await searchParams;
  const page = Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1);
  const programSlug = sp.program && /^[a-z0-9-]{1,80}$/.test(sp.program) ? sp.program : undefined;
  const [episodes, programs] = await Promise.all([getEpisodes({ page, pageSize: 12, programSlug }), getPrograms()]);
  const base = localePath(locale, '/episodes');

  return (
    <>
      <PageHeader eyebrow={dict.nav.podcast} title={dict.episodes.title} intro={dict.episodes.intro} />
      <div className="container-page">
        {programs.length > 1 && (
          <nav aria-label={dict.episodes.filterProgram} className="mb-10 flex flex-wrap gap-2">
            <Link href={base} aria-current={!programSlug ? 'page' : undefined} className="btn btn-ghost min-h-10 px-4 text-sm aria-[current=page]:border-fg aria-[current=page]:bg-fg aria-[current=page]:text-bg">
              {dict.common.all}
            </Link>
            {programs.map((program) => (
              <Link
                key={program.id}
                href={`${base}?program=${program.slug}`}
                aria-current={programSlug === program.slug ? 'page' : undefined}
                className="btn btn-ghost min-h-10 px-4 text-sm aria-[current=page]:border-fg aria-[current=page]:bg-fg aria-[current=page]:text-bg"
              >
                {pick(locale, program.title, program.titleEn)}
              </Link>
            ))}
          </nav>
        )}
        {episodes.items.length === 0 ? (
          <EmptyState title={dict.episodes.empty} />
        ) : (
          <>
            <EpisodeList episodes={episodes.items} locale={locale} dict={dict} />
            <Pagination page={episodes.page} total={episodes.total} pageSize={episodes.pageSize} basePath={programSlug ? `${base}?program=${programSlug}` : base} dict={dict} />
          </>
        )}
      </div>
    </>
  );
}
