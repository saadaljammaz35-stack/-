import { requireStaffPage } from '@/lib/auth/staff';
import { userDb } from '@/lib/supabase/server';
import { adminDb } from '@/lib/supabase/admin';
import { getLocale } from '@/lib/i18n/server';
import { adminDicts } from '@/lib/i18n/admin';
import { PageHeader } from '@/components/admin/ui';
import { CustomersManager, type CustomerRow } from '@/components/admin/CustomersManager';

const SORTS = ['recent', 'points', 'spent', 'orders'] as const;
const PAGE = 30;

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; sort?: string; page?: string }> }) {
  await requireStaffPage('loyalty.manage', '/admin/customers');
  const a = adminDicts[await getLocale()];
  const { q = '', sort = 'recent', page = '1' } = await searchParams;
  const s = (SORTS as readonly string[]).includes(sort) ? sort : 'recent';
  const p = Math.max(1, Number(page) || 1);
  const db = await userDb();
  const [{ data, error }, { data: settings }] = await Promise.all([
    db.rpc('admin_customers', { p_search: q || null, p_sort: s, p_limit: PAGE, p_offset: (p - 1) * PAGE }),
    adminDb().from('store_settings').select('loyalty_point_value_halalas').eq('id', 1).single(),
  ]);
  if (error) throw error;
  const rows = (data ?? []) as CustomerRow[];
  const total = Number(rows[0]?.total_count ?? 0);
  return (
    <div>
      <PageHeader title={a.customers.title} subtitle={a.customers.subtitle} />
      <CustomersManager rows={rows} total={total} q={q} sort={s} page={p} pageSize={PAGE} pointValue={settings?.loyalty_point_value_halalas ?? 0} />
    </div>
  );
}
