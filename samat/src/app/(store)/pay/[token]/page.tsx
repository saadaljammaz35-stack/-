import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getDict } from '@/lib/i18n/server';
import { fill } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';
import { adminDb } from '@/lib/supabase/admin';
import { PaymentPanel } from '@/components/pay/PaymentPanel';
import { Countdown } from '@/components/ui/Countdown';

export const metadata: Metadata = { robots: { index: false } };

export default async function PayPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ failed?: string }> }) {
  const { token } = await params;
  const { failed } = await searchParams;
  if (!/^[A-Za-z0-9_-]{20,60}$/.test(token)) notFound();
  const { t, locale } = await getDict();
  const { data: o } = await adminDb().from('orders').select('order_number, status, total, expires_at').eq('tracking_token', token).maybeSingle();
  if (!o) notFound();
  if (o.status !== 'pending_payment') redirect(`/t/${token}`);
  const minutes = o.expires_at ? Math.max(0, Math.round((new Date(o.expires_at).getTime() - Date.now()) / 60000)) : 0;
  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:px-6">
      <div className="paper rounded-[2rem] p-6 sm:p-8">
        <p className="eyebrow text-terracotta-500">{t.pay.title} · #{o.order_number}</p>
        <div className="mt-2 flex items-end justify-between gap-3">
          <div>
            <p className="text-sm text-espresso-500">{t.pay.amount}</p>
            <p className="num text-4xl font-bold" data-testid="pay-amount">{formatMoney(o.total, locale)}</p>
          </div>
          {o.expires_at && <Countdown until={o.expires_at} label={fill(t.pay.expiresIn, { n: minutes })} />}
        </div>
        <div className="mt-6"><PaymentPanel token={token} failed={failed === '1'} /></div>
      </div>
    </div>
  );
}
