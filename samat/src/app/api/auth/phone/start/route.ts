import { z } from 'zod';
import { startPhoneLogin } from '@/lib/auth/phone-otp';
import { getLocale } from '@/lib/i18n/server';
import { clientIp, rateLimit } from '@/lib/rate-limit';
import { AppError, errorResponse } from '@/lib/errors';

const Body = z.object({ phone: z.string().min(9).max(20) });

/** Sends a sign-in code to a Saudi mobile number. */
export async function POST(req: Request) {
  try {
    // generous per IP (mobile carriers share IPs); the per-number limits in startPhoneLogin stop SMS abuse
    await rateLimit('otp:start', await clientIp(), 30, 600);
    const b = Body.safeParse(await req.json());
    if (!b.success) throw new AppError('invalid_phone');
    await startPhoneLogin(b.data.phone, (await getLocale()) === 'en' ? 'en' : 'ar');
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
