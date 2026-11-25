import { notFound } from 'next/navigation';
import { ActionButton } from '@/components/admin/ActionButton';
import { EntityForm } from '@/components/admin/EntityForm';
import { AdminHeader } from '@/components/admin/ui';
import { deleteContent, saveGuest } from '@/lib/admin/actions/content';
import { can, requireStaff } from '@/lib/admin/auth';
import { guestFields, toFormValues } from '@/lib/admin/forms';
import { getRow, mediaOptions } from '@/lib/admin/queries';

export const metadata = { title: 'تحرير ضيف' };

const DEFAULTS = {
  slug: '',
  name: '',
  name_en: '',
  headline: '',
  headline_en: '',
  bio: '',
  bio_en: '',
  photo_id: '',
  website_url: '',
  x_handle: '',
  instagram_handle: '',
  linkedin_url: '',
  status: 'draft',
  published_at: '',
};

export default async function GuestEditor({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff('content.edit_any');
  const { id } = await params;
  const isNew = id === 'new';
  const row = isNew ? null : await getRow('guests', id);
  if (!isNew && !row) notFound();
  const media = await mediaOptions();
  return (
    <>
      <AdminHeader
        title={isNew ? 'ضيف جديد' : String(row?.name)}
        back={{ href: '/admin/guests', label: 'الضيوف' }}
        actions={!isNew && can(staff, 'content.delete') && <ActionButton action={deleteContent.bind(null, 'guests', id)} label="حذف" tone="danger" confirm="حذف الضيف؟" />}
      />
      <EntityForm schema="guest" action={saveGuest} fields={guestFields(can(staff, 'content.publish'))} defaultValues={toFormValues(row, DEFAULTS)} media={media} />
    </>
  );
}
