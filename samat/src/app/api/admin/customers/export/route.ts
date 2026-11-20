import { requireStaff } from '@/lib/auth/staff';
import { userDb } from '@/lib/supabase/server';
import { errorResponse, fromDbError } from '@/lib/errors';

const cell = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Registered customers as CSV (opens in Excel with Arabic intact). loyalty.manage. */
export async function GET() {
  try {
    await requireStaff('loyalty.manage');
    const db = await userDb();
    const rows: Record<string, unknown>[] = [];
    for (let offset = 0; offset < 20000; offset += 500) {
      const { data, error } = await db.rpc('admin_customers', { p_search: null, p_sort: 'recent', p_limit: 500, p_offset: offset });
      if (error) throw fromDbError(error);
      rows.push(...(data ?? []));
      if (!data || data.length < 500) break;
    }
    const head = ['name', 'phone', 'email', 'sign_in', 'points', 'lifetime_points', 'orders', 'spent_sar', 'last_order', 'joined'];
    const lines = rows.map((r) => [r.full_name, r.phone, r.email, r.via, r.balance, r.lifetime_earned, r.orders,
      (Number(r.spent) / 100).toFixed(2), r.last_order_at, r.joined_at].map(cell).join(','));
    return new Response(`﻿${[head.join(','), ...lines].join('\n')}`, {
      headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="samat-customers.csv"', 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
