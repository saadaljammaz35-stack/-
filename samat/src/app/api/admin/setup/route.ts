import { z } from 'zod';
import { redeemAccessLink, MIN_PASSWORD } from '@/lib/auth/access-links';
import { clientIp, rateLimit } from '@/lib/rate-limit';
import { AppError, errorResponse } from '@/lib/errors';

const Body = z.object({ token: z.string().min(20).max(200), password: z.string().min(MIN_PASSWORD).max(200) });

/** Sets a staff password from a single-use access link (public; the link is the credential). */
export async function POST(req: Request) {
  try {
    await rateLimit('staff:setup', await clientIp(), 10, 600);
    const b = Body.safeParse(await req.json());
    if (!b.success) throw new AppError(b.error.issues.some((i) => i.path[0] === 'password') ? 'weak_password' : 'link_invalid');
    return Response.json({ ok: true, ...(await redeemAccessLink(b.data.token, b.data.password)) });
  } catch (e) {
    return errorResponse(e);
  }
}
