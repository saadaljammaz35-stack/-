import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/site/blocks';
import { searchContent } from '@/lib/data/public';
import { formatDate } from '@/lib/format';
import { getDictionary, resolveLocale, t } from '@/lib/i18n';
import { localePath, pick } from '@/lib/i18n/config';
import { pageMetadata } from '@/lib/seo';
import type { SearchKind } from '@/lib/types';

const PATHS: Record<SearchKind, string> = {
  episode: '/episodes',
  article: '/stories',
  guest: '/guests',
  program: '/programs',
  clip: '/clips',
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const dict = getDictionary(locale);
  return pageMetadata({ locale, path: '/search', title: dict.search.title, noIndex: true });
}

export default async function SearchPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ q?: string }> }) {
  const locale = await resolveLocale(params);
  const dict = getDictionary(locale);
  const q = ((await searchParams).q ?? '').trim().slice(0, 120);
  const results = q.length >= 2 ? await searchContent(q) : [];

  return (
    <>
      <PageHeader title={dict.search.title}>
        <form role="search" action={localePath(locale, '/search')} className="mt-10 flex max-w-3xl items-end gap-4">
          <label htmlFor="q" className="sr-only">
            {dict.search.placeholder}
          </label>
          <input id="q" name="q" type="search" defaultValue={q} placeholder={dict.search.placeholder} minLength={2} maxLength={120} className="field text-xl md:text-2xl" autoComplete="off" enterKeyHint="search" />
          <button type="submit" className="btn btn-primary shrink-0">
            {dict.search.submit}
          </button>
        </form>
        {!q && <p className="mt-4 text-sm text-muted">{dict.search.hint}</p>}
      </PageHeader>
      <div className="container-page">
        {q && results === null && <p className="text-muted">{dict.search.unavailable}</p>}
        {q && results && (
          <section aria-live="polite">
            <h2 className="mb-6 text-sm text-muted">{results.length ? t(dict.search.resultsFor, { q }) : t(dict.search.noResults, { q })}</h2>
            <ul className="border-t border-line">
              {results.map((r) => (
                <li key={`${r.kind}-${r.id}`} className="border-b border-line">
                  <Link href={r.kind === 'clip' ? localePath(locale, '/clips') : localePath(locale, `${PATHS[r.kind]}/${r.slug}`)} className="group grid gap-2 py-6 md:grid-cols-[8rem_1fr]">
                    <span className="text-sm text-accent">{dict.search.kinds[r.kind]}</span>
                    <span>
                      <span className="block text-xl font-bold group-hover:text-accent">{pick(locale, r.title, r.titleEn)}</span>
                      {r.excerpt && <span className="mt-1 block text-muted">{r.excerpt}</span>}
                      {r.publishedAt && r.kind !== 'guest' && <span className="mt-2 block text-xs text-muted">{formatDate(r.publishedAt, locale)}</span>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
