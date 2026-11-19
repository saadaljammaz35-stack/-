import { requireStaffPage } from '@/lib/auth/staff';
import { userDb } from '@/lib/supabase/server';
import { getLocale } from '@/lib/i18n/server';
import { adminDicts } from '@/lib/i18n/admin';
import { PageHeader } from '@/components/admin/ui';
import { InventoryManager, type InvRow } from '@/components/admin/InventoryManager';

export default async function InventoryPage() {
  await requireStaffPage('inventory.manage', '/admin/inventory');
  const a = adminDicts[await getLocale()];
  const db = await userDb();
  const [{ data: rows }, { data: moves }] = await Promise.all([
    db.rpc('inventory_status'),
    db.from('inventory_movements').select('id, inventory_id, movement, quantity, balance_after, note, created_at').order('created_at', { ascending: false }).limit(60),
  ]);
  return (
    <div>
      <PageHeader title={a.inv.title} subtitle={a.inv.hint} />
      <InventoryManager rows={(rows ?? []) as InvRow[]} movements={moves ?? []} />
    </div>
  );
}
