import { requireStaffPage } from '@/lib/auth/staff';
import { userDb } from '@/lib/supabase/server';
import { getLocale } from '@/lib/i18n/server';
import { adminDicts } from '@/lib/i18n/admin';
import { PageHeader } from '@/components/admin/ui';
import { LibraryEditor } from '@/components/admin/LibraryEditor';

export default async function Page() {
  await requireStaffPage('menu.manage', '/admin/menu/sauces');
  const a = adminDicts[await getLocale()];
  const db = await userDb();
  const [{ data: rows }, { data: inv }] = await Promise.all([
    db.from('sauces').select('*').order('sort_order'),
    db.from('inventory').select('id, name_ar, name_en').order('name_en'),
  ]);
  return (
    <div>
      <PageHeader title={a.nav.sauces} subtitle={a.inv.hint} />
      <LibraryEditor entity="sauces" rows={(rows ?? []).map((r) => ({ ...r, layer_height: r.layer_height !== undefined ? Number(r.layer_height) : undefined, inventory_qty: Number(r.inventory_qty) }))} inventory={inv ?? []} />
    </div>
  );
}
