import type { Metadata } from 'next';
import Link from 'next/link';
import { ArticleRow, EmptyState, PageHeader, Pagination } from '@/components/site/blocks';
import { getArticles } from '@/lib/data/public';
import { getDictionary, resolveLocale } from '@/lib/i18n';
import { localePath } from '@/lib/i18n/config';
import { pageMetadata } from '@/lib/seo';
import type { ArticleKind } from '@/lib/types';

const KINDS: ArticleKind[] = ['story', 'article', 'essay', 'interview'];

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const dict = getDictionary(locale);
  return pageMetadata({ locale, path: '/stories', title: dict.stories.title, description: dict.stories.intro });
}

export default async function StoriesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ page?: string; kind?: string }> }) {
  const locale = await resolveLocale(params);
  const dict = getDictionary(locale);
  const sp = await searchParams;
  const page = Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1);
  const kind = KINDS.includes(sp.kind as ArticleKind) ? (sp.kind as ArticleKind) : undefined;
  const articles = await getArticles({ page, kind, pageSize: 10 });
  const base = localePath(locale, '/stories');
  const [lead, ...rest] = articles.items;
  const chip = 'btn btn-ghost min-h-10 px-4 text-sm aria-[current=page]:border-fg aria-[current=page]:bg-fg aria-[current=page]:text-bg';

  return (
    <>
      <PageHeader title={dict.stories.title} intro={dict.stories.intro} />
      <div className="container-page">
        <nav aria-label={dict.stories.title} className="mb-12 flex flex-wrap gap-2">
          <Link href={base} aria-current={!kind ? 'page' : undefined} className={chip}>
            {dict.common.all}
          </Link>
          {KINDS.map((k) => (
            <Link key={k} href={`${base}?kind=${k}`} aria-current={kind === k ? 'page' : undefined} className={chip}>
              {dict.stories.kinds[k]}
            </Link>
          ))}
        </nav>
        {!lead ? (
          <EmptyState title={dict.stories.empty} />
        ) : (
          <>
            {page === 1 ? <ArticleRow article={lead} locale={locale} dict={dict} large /> : null}
            <div className="mt-16 grid gap-x-10 gap-y-14 border-t border-line pt-12 md:grid-cols-2">
              {(page === 1 ? rest : articles.items).map((article) => (
                <ArticleRow key={article.id} article={article} locale={locale} dict={dict} />
              ))}
            </div>
            <Pagination page={articles.page} total={articles.total} pageSize={articles.pageSize} basePath={kind ? `${base}?kind=${kind}` : base} dict={dict} />
          </>
        )}
      </div>
    </>
  );
}
