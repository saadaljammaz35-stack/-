import { adminDb } from '@/lib/supabase/admin';

/** Public, PII-free list of ready / recently handed-over order numbers for the in-store screen. */
export async function GET() {
  const { data } = await adminDb().rpc('pickup_board');
  return Response.json(data ?? { enabled: false }, { headers: { 'Cache-Control': 'no-store' } });
}
