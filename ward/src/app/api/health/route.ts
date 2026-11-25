import { NextResponse } from 'next/server';
import { system } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await system((q) => q.query('select 1'));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
