import { z } from 'zod';
import { requireStaff } from '@/lib/auth/staff';
import { userDb } from '@/lib/supabase/server';
import { AppError, errorResponse, fromDbError } from '@/lib/errors';

const Body = z.object({
  accepting_orders: z.boolean().optional(),
  busy_mode: z.boolean().optional(),
  busy_extra_minutes: z.number().int().min(0).max(240).optional(),
  max_active_orders: z.number().int().min(0).max(500).nullable().optional(),
  pause_message_ar: z.string().max(200).optional(),
  pause_message_en: z.string().max(200).optional(),
  busy_message_ar: z.string().max(200).optional(),
  busy_message_en: z.string().max(200).optional(),
});

/** Busy mode / pause / reopen. Permission busy.manage is checked here and again inside the database. */
export async function POST(req: Request) {
  try {
    await requireStaff('busy.manage');
    const b = Body.safeParse(await req.json());
    if (!b.success) throw new AppError('invalid_request');
    const p: Record<string, unknown> = { ...b.data };
    if (b.data.max_active_orders === null) p.max_active_orders = 0;
    const { data, error } = await (await userDb()).rpc('staff_set_ordering', { p });
    if (error) throw fromDbError(error);
    return Response.json(data);
  } catch (e) {
    return errorResponse(e);
  }
}
