import { MediaLibrary } from '@/components/admin/MediaLibrary';
import { AdminHeader, Filters, formatAdminDate } from '@/components/admin/ui';
import { can, requireStaff } from '@/lib/admin/auth';
import { listTable } from '@/lib/admin/queries';
import { storagePublicUrl } from '@/lib/env';

export const metadata = { title: 'مكتبة الوسائط' };

export default async function MediaAdmin({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const staff = await requireStaff('media.upload');
  const { kind } = await searchParams;
  const valid = kind === 'image' || kind === 'audio' || kind === 'video' ? kind : undefined;
  const rows = await listTable('media_assets', 'id, bucket, path, kind, original_name, alt, bytes, created_at', {
    order: 'created_at',
    limit: 300,
    ...(valid ? { filter: ['kind', valid] as [string, string] } : {}),
  });
  const items = rows.map((r) => ({
    id: String(r.id),
    kind: r.kind as 'image' | 'audio' | 'video',
    url: storagePublicUrl(String(r.bucket), String(r.path)) ?? '',
    name: String(r.original_name ?? r.path),
    alt: String(r.alt ?? ''),
    bytes: Number(r.bytes),
    created: formatAdminDate(r.created_at as string),
  }));
  return (
    <>
      <AdminHeader title="مكتبة الوسائط" description="الصور حتى 10 م.ب، الصوت حتى 500 م.ب، الفيديو حتى 300 م.ب. يُفحص نوع كل ملف من محتواه الفعلي قبل قبوله." />
      <Filters
        base="/admin/media"
        param="kind"
        current={valid}
        options={[
          { value: 'image', label: 'صور' },
          { value: 'audio', label: 'صوت' },
          { value: 'video', label: 'فيديو' },
        ]}
      />
      <MediaLibrary items={items} canDelete={can(staff, 'media.delete')} />
    </>
  );
}
