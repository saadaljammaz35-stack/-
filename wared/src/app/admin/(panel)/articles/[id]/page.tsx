import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ActionButton } from '@/components/admin/ActionButton';
import { EntityForm } from '@/components/admin/EntityForm';
import { AdminHeader, Notice } from '@/components/admin/ui';
import { deleteContent, saveArticle } from '@/lib/admin/actions/content';
import { can, requireStaff } from '@/lib/admin/auth';
import { articleFields, toFormValues } from '@/lib/admin/forms';
import { categoryOptions, episodeOptions, getRow, mediaOptions } from '@/lib/admin/queries';

export const metadata = { title: 'تحرير مقال' };

const DEFAULTS = {
  slug: '',
  kind: 'article',
  category_id: '',
  title: '',
  title_en: '',
  dek: '',
  dek_en: '',
  body: '',
  body_en: '',
  cover_image_id: '',
  author_name: '',
  related_episode_id: '',
  is_featured: false,
  status: 'draft',
  published_at: '',
};

export default async function ArticleEditor({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff('content.create');
  const { id } = await params;
  const isNew = id === 'new';
  const row = isNew ? null : await getRow('articles', id);
  if (!isNew && !row) notFound();
  const editAny = can(staff, 'content.edit_any');
  const locked = !isNew && !editAny && (row?.created_by !== staff.id || !['draft', 'review'].includes(String(row?.status)));
  const [categories, episodes, media] = await Promise.all([categoryOptions(), episodeOptions(), mediaOptions()]);
  const canDelete = !isNew && (can(staff, 'content.delete') || (row?.created_by === staff.id && row?.status === 'draft'));
  return (
    <>
      <AdminHeader
        title={isNew ? 'مقال جديد' : String(row?.title)}
        back={{ href: '/admin/articles', label: 'القصص والمقالات' }}
        actions={
          !isNew && (
            <>
              <Link href={`/admin/preview/articles/${id}`} className="btn btn-ghost min-h-10 px-4 text-sm" target="_blank">
                معاينة
              </Link>
              {canDelete && <ActionButton action={deleteContent.bind(null, 'articles', id)} label="حذف" tone="danger" confirm="حذف المقال نهائيًا؟" />}
            </>
          )
        }
      />
      {locked ? (
        <Notice>هذا المقال لم يعد مسودة لك، فتعديله الآن من صلاحيات المحرر.</Notice>
      ) : (
        <EntityForm schema="article" action={saveArticle} fields={articleFields(can(staff, 'content.publish'), categories, episodes)} defaultValues={toFormValues(row, DEFAULTS)} media={media} />
      )}
    </>
  );
}
