import { requireStaff } from '@/lib/auth/staff';
import { userDb } from '@/lib/supabase/server';
import { errorResponse, fromDbError } from '@/lib/errors';

export async function GET() {
  try {
    await requireStaff('kitchen.view');
    const { data, error } = await (await userDb()).rpc('kitchen_orders');
    if (error) throw fromDbError(error);
    return Response.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return errorResponse(e);
  }
}
