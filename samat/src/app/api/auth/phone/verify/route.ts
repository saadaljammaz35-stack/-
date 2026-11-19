import { z } from 'zod';
import { verifyPhoneLogin } from '@/lib/auth/phone-otp';
import { getLocale } from '@/lib/i18n/server';
import { clientIp, rateLimit } from '@/lib/rate-limit';
import { AppError, errorResponse } from '@/lib/errors';

const Body = z.object({ phone: z.string().min(9).max(20), code: z.string().regex(/^\d{6}$/) });

/** Checks the code and signs the customer in (session cookie). */
export async function POST(req: Request) {
  try {
    await rateLimit('otp:verify', await clientIp(), 40, 600);
    const b = Body.safeParse(await req.json());
    if (!b.success) throw new AppError('otp_invalid');
    await verifyPhoneLogin(b.data.phone, b.data.code, (await getLocale()) === 'en' ? 'en' : 'ar');
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
