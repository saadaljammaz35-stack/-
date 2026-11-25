import { NextResponse } from 'next/server';
import { getStaff } from '@/lib/admin/auth';
import { getSessionClient } from '@/lib/supabase/server';

/** CSV export of newsletter subscribers (subscribers.manage only; RLS enforces it too). */
export async function GET(request: Request) {
  const { staff } = await getStaff();
  if (!staff || !staff.permissions.includes('subscribers.manage')) return new NextResponse('Forbidden', { status: 403 });
  const db = await getSessionClient();
  if (!db) return new NextResponse('Not configured', { status: 503 });
  const status = new URL(request.url).searchParams.get('status');
  let query = db.from('subscribers').select('email, status, locale, source, created_at, confirmed_at').order('created_at', { ascending: false }).limit(50000);
  if (status && ['active', 'pending', 'unsubscribed'].includes(status)) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) return new NextResponse('Error', { status: 500 });
  // Prefix cells that start with formula characters so spreadsheets do not execute them.
  const cell = (v: unknown) => {
    let s = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const header = 'email,status,locale,source,created_at,confirmed_at';
  const lines = (data ?? []).map((r) => [r.email, r.status, r.locale, r.source, r.created_at, r.confirmed_at].map(cell).join(','));
  return new NextResponse(`﻿${[header, ...lines].join('\n')}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="wared-subscribers-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
