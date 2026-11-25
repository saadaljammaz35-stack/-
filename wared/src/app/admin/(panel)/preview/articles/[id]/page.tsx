import { notFound } from 'next/navigation';
import { PreviewShell } from '@/components/admin/PreviewShell';
import { Cover } from '@/components/site/blocks';
import { RichText } from '@/components/ui/RichText';
import { requireStaff } from '@/lib/admin/auth';
import { STATUS_LABELS } from '@/lib/admin/permissions';
import { ARTICLE_COLUMNS, mapArticle } from '@/lib/data/mappers';
import { getSessionClient } from '@/lib/supabase/server';

export const metadata = { title: 'معاينة مقال' };

export default async function ArticlePreview({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff('content.read_all');
  const { id } = await params;
  const db = await getSessionClient();
  const { data } = db && /^[0-9a-f-]{36}$/i.test(id) ? await db.from('articles').select(`${ARTICLE_COLUMNS}, status`).eq('id', id).maybeSingle() : { data: null };
  if (!data) notFound();
  const article = mapArticle(data as Record<string, unknown>);
  return (
    <PreviewShell status={STATUS_LABELS[(data as { status: keyof typeof STATUS_LABELS }).status]}>
      <article>
        <h1 className="display max-w-5xl text-[clamp(2.25rem,6vw,5rem)]">{article.title}</h1>
        {article.dek && <p className="mt-6 max-w-3xl text-xl leading-9 text-muted">{article.dek}</p>}
        {article.cover && <Cover media={article.cover} alt="" sizes="100vw" className="mt-10 aspect-[16/9] rounded-[28px]" />}
        <div className="mx-auto mt-12 max-w-[40rem]">
          <RichText text={article.body} />
        </div>
      </article>
    </PreviewShell>
  );
}
