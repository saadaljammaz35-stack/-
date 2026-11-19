import { z } from 'zod';
import { initPayment } from '@/lib/orders/service';
import { AppError, errorResponse } from '@/lib/errors';
import { getPublicSettings } from '@/lib/catalog';
import { env } from '@/lib/env';
import { adminDb } from '@/lib/supabase/admin';
import { clientIp, rateLimit } from '@/lib/rate-limit';

const Body = z.object({ token: z.string().min(20).max(60) });

export async function POST(req: Request) {
  try {
    await rateLimit('pay:init', await clientIp(), 30, 600);
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) throw new AppError('invalid_request');
    const [p, settings] = await Promise.all([initPayment(parsed.data.token), getPublicSettings()]);
    const methods = (['creditcard', 'applepay', 'stcpay'] as const).filter((m) => settings.payment_methods[m]);
    return Response.json({
      provider: p.provider,
      amount: p.amount,
      currency: 'SAR',
      description: `SAMAT #${p.orderNumber}`,
      metadata: { order_id: p.orderId, payment_row_id: p.paymentRowId },
      paymentRowId: p.paymentRowId,
      publishableKey: p.provider === 'moyasar' ? env.moyasarPublishableKey : null,
      callbackUrl: `${env.siteUrl}/pay/${parsed.data.token}/return`,
      methods,
      networks: settings.card_networks,
      manual: await manualCapture(),
      applePayLabel: env.moyasarApplePayLabel,
      validateMerchantUrl: 'https://api.moyasar.com/v1/applepay/initiate',
    });
  } catch (e) {
    return errorResponse(e);
  }
}

async function manualCapture(): Promise<boolean> {
  const { data } = await adminDb().from('store_settings').select('manual_capture').eq('id', 1).single();
  return Boolean(data?.manual_capture);
}
