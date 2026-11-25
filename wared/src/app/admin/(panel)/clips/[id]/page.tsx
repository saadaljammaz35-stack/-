import { notFound } from 'next/navigation';
import { ActionButton } from '@/components/admin/ActionButton';
import { EntityForm } from '@/components/admin/EntityForm';
import { AdminHeader } from '@/components/admin/ui';
import { deleteContent, saveClip } from '@/lib/admin/actions/content';
import { can, requireStaff } from '@/lib/admin/auth';
import { clipFields, toFormValues } from '@/lib/admin/forms';
import { episodeOptions, getRow, mediaOptions } from '@/lib/admin/queries';

export const metadata = { title: 'تحرير مقطع' };

const DEFAULTS = {
  slug: '',
  title: '',
  title_en: '',
  description: '',
  episode_id: '',
  video_asset_id: '',
  thumbnail_id: '',
  youtube_video_id: '',
  external_url: '',
  orientation: 'vertical',
  duration_seconds: '',
  status: 'draft',
  published_at: '',
};

export default async function ClipEditor({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff('content.edit_any');
  const { id } = await params;
  const isNew = id === 'new';
  const row = isNew ? null : await getRow('clips', id);
  if (!isNew && !row) notFound();
  const [episodes, media] = await Promise.all([episodeOptions(), mediaOptions()]);
  return (
    <>
      <AdminHeader
        title={isNew ? 'مقطع جديد' : String(row?.title)}
        back={{ href: '/admin/clips', label: 'المقاطع' }}
        actions={!isNew && can(staff, 'content.delete') && <ActionButton action={deleteContent.bind(null, 'clips', id)} label="حذف" tone="danger" confirm="حذف المقطع؟" />}
      />
      <EntityForm schema="clip" action={saveClip} fields={clipFields(can(staff, 'content.publish'), episodes)} defaultValues={toFormValues(row, DEFAULTS)} media={media} />
    </>
  );
}
