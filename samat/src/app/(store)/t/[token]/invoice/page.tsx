import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { adminDb } from '@/lib/supabase/admin';
import { getReceiptData } from '@/lib/printing/receipt-data';
import { Receipt } from '@/components/admin/Receipt';
import { PrintButton } from '@/components/ui/PrintButton';

export const metadata: Metadata = { robots: { index: false }, referrer: 'no-referrer' };

/** The customer's own invoice (reachable only with the private tracking token). */
export default async function CustomerInvoice({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{20,60}$/.test(token)) notFound();
  const { data: o } = await adminDb().from('orders').select('id').eq('tracking_token', token).maybeSingle();
  if (!o) notFound();
  const d = await getReceiptData(o.id, 'customer_receipt');
  if (!d?.invoice) notFound();
  return (
    <div className="py-8">
      <div className="no-print mb-4 flex justify-center"><PrintButton /></div>
      <div className="mx-auto w-fit rounded-2xl bg-white p-6 shadow-lift print:shadow-none"><Receipt d={d} format="a4" /></div>
    </div>
  );
}
