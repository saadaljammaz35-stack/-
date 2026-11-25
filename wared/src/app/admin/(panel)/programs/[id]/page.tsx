import { notFound } from 'next/navigation';
import { ActionButton } from '@/components/admin/ActionButton';
import { EntityForm } from '@/components/admin/EntityForm';
import { AdminHeader } from '@/components/admin/ui';
import { deleteContent, saveProgram } from '@/lib/admin/actions/content';
import { can, requireStaff } from '@/lib/admin/auth';
import { programFields, toFormValues } from '@/lib/admin/forms';
import { getRow, mediaOptions } from '@/lib/admin/queries';
import { absoluteUrl } from '@/lib/env';

export const metadata = { title: 'تحرير برنامج' };

const DEFAULTS = {
  slug: '',
  kind: 'podcast',
  title: '',
  title_en: '',
  tagline: '',
  tagline_en: '',
  description: '',
  description_en: '',
  hosts: '',
  cover_image_id: '',
  language: 'ar',
  explicit: false,
  itunes_category: 'Society & Culture',
  apple_podcasts_url: '',
  spotify_url: '',
  youtube_playlist_url: '',
  anghami_url: '',
  sort_order: 0,
  status: 'draft',
  published_at: '',
};

export default async function ProgramEditor({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff('content.edit_any');
  const { id } = await params;
  const isNew = id === 'new';
  const row = isNew ? null : await getRow('podcasts', id);
  if (!isNew && !row) notFound();
  const media = await mediaOptions();
  return (
    <>
      <AdminHeader
        title={isNew ? 'برنامج جديد' : String(row?.title)}
        description={row ? `خلاصة RSS: ${absoluteUrl(`/rss/${row.slug}`)}` : undefined}
        back={{ href: '/admin/programs', label: 'البرامج' }}
        actions={
          !isNew &&
          can(staff, 'content.delete') && (
            <ActionButton action={deleteContent.bind(null, 'podcasts', id)} label="حذف" tone="danger" confirm="حذف البرنامج؟ لا يمكن حذف برنامج فيه حلقات." />
          )
        }
      />
      <EntityForm schema="program" action={saveProgram} fields={programFields(can(staff, 'content.publish'))} defaultValues={toFormValues(row, DEFAULTS)} media={media} />
    </>
  );
}
