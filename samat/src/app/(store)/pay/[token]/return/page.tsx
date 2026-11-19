import { redirect, notFound } from 'next/navigation';
import { adminDb } from '@/lib/supabase/admin';
import { confirmPayment } from '@/lib/orders/service';
import { activeProvider } from '@/lib/payments';

// Moyasar sends the customer back here with ?id=<payment id>. We verify the payment with Moyasar's
// API (server to server) — the query string is never trusted on its own.
export default async function PaymentReturn({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ id?: string }> }) {
  const { token } = await params;
  const { id } = await searchParams;
  const { data: o } = await adminDb().from('orders').select('id').eq('tracking_token', token).maybeSingle();
  if (!o) notFound();
  if (!id) redirect(`/pay/${token}`);
  let failed = false;
  try {
    const r = await confirmPayment(id, activeProvider(), o.id);
    failed = r.payment === 'failed';
  } catch {
    failed = true;
  }
  redirect(failed ? `/pay/${token}?failed=1` : `/t/${token}`);
}
