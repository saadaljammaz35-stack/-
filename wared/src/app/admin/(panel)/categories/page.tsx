import { ActionButton } from '@/components/admin/ActionButton';
import { EntityForm } from '@/components/admin/EntityForm';
import { AdminHeader, Row, RowList } from '@/components/admin/ui';
import { deleteContent, saveCategory } from '@/lib/admin/actions/content';
import { can, requireStaff } from '@/lib/admin/auth';
import { listTable } from '@/lib/admin/queries';

export const metadata = { title: 'التصنيفات' };

export default async function CategoriesAdmin() {
  const staff = await requireStaff('content.edit_any');
  const rows = await listTable('categories', 'id, slug, name, name_en', { order: 'sort_order' });
  return (
    <>
      <AdminHeader title="التصنيفات" description="تصنيفات القصص والمقالات." />
      <RowList empty="لا توجد تصنيفات بعد.">
        {rows.map((r) => (
          <Row
            key={String(r.id)}
            title={String(r.name)}
            meta={<span dir="ltr">{String(r.slug)}</span>}
            aside={can(staff, 'content.delete') && <ActionButton action={deleteContent.bind(null, 'categories', String(r.id))} label="حذف" confirm="حذف التصنيف؟ ستبقى المقالات بدون تصنيف." />}
          />
        ))}
      </RowList>
      <div className="mt-14 max-w-3xl">
        <h2 className="mb-6 text-lg font-bold">تصنيف جديد</h2>
        <EntityForm
          schema="category"
          action={saveCategory}
          resetOnSuccess
          submitLabel="إضافة"
          defaultValues={{ slug: '', name: '', name_en: '', description: '', sort_order: 0 }}
          fields={[
            { type: 'text', name: 'name', label: 'الاسم' },
            { type: 'text', name: 'name_en', label: 'الاسم بالإنجليزية', dir: 'ltr' },
            { type: 'text', name: 'slug', label: 'الرابط المختصر', dir: 'ltr' },
            { type: 'number', name: 'sort_order', label: 'الترتيب' },
          ]}
        />
      </div>
    </>
  );
}
