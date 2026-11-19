import { currentUser } from '@/lib/supabase/server';
import { createOrder } from '@/lib/orders/service';
import { errorResponse } from '@/lib/errors';
import { clientIp, rateLimit } from '@/lib/rate-limit';

export async function POST(req: Request) {
  try {
    const ip = await clientIp();
    await rateLimit('order:ip', ip, 12, 600);
    const body = await req.json();
    const phone = String(body?.customer?.phone ?? '');
    if (phone) await rateLimit('order:phone', phone, 8, 600);
    const user = await currentUser();
    const res = await createOrder(body, user?.id ?? null);
    return Response.json(res, { status: res.replay ? 200 : 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
