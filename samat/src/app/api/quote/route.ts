import { currentUser } from '@/lib/supabase/server';
import { quote } from '@/lib/orders/service';
import { errorResponse } from '@/lib/errors';
import { clientIp, rateLimit } from '@/lib/rate-limit';

export async function POST(req: Request) {
  try {
    await rateLimit('quote', await clientIp(), 120, 60);
    const user = await currentUser();
    return Response.json(await quote(await req.json(), user?.id ?? null));
  } catch (e) {
    return errorResponse(e);
  }
}
