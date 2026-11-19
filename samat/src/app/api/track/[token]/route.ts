import { getTrackedOrder } from '@/lib/orders/service';
import { clientIp, rateLimit } from '@/lib/rate-limit';
import { errorResponse } from '@/lib/errors';

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    await rateLimit('track', await clientIp(), 240, 60);
    const { token } = await params;
    const o = await getTrackedOrder(token);
    if (!o) return Response.json({ error: 'order_not_found' }, { status: 404 });
    return Response.json(o, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return errorResponse(e);
  }
}
