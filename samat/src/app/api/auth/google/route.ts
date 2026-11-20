import { z } from 'zod';
import { googleSignIn } from '@/lib/auth/customer';
import { getLocale } from '@/lib/i18n/server';
import { clientIp, rateLimit } from '@/lib/rate-limit';
import { AppError, errorResponse } from '@/lib/errors';

const Body = z.object({ credential: z.string().min(100).max(4096) });

/** Google sign-in for customers: verifies the ID token server-side and opens a session. */
export async function POST(req: Request) {
  try {
    await rateLimit('auth:google', await clientIp(), 30, 600);
    const b = Body.safeParse(await req.json());
    if (!b.success) throw new AppError('google_invalid');
    await googleSignIn(b.data.credential, (await getLocale()) === 'en' ? 'en' : 'ar');
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
