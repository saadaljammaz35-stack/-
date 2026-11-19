import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { requireStaffPage } from '@/lib/auth/staff';
import { adminDb } from '@/lib/supabase/admin';
import { getReceiptData } from '@/lib/printing/receipt-data';
import { Receipt } from '@/components/admin/Receipt';
import { PrintControls } from '@/components/admin/PrintControls';
import { getLocale } from '@/lib/i18n/server';

export const metadata: Metadata = { title: 'Print', robots: { index: false } };

export default async function PrintPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ format?: string; kind?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const staff = await requireStaffPage('invoices.print', `/admin/print/${id}`);
  const format = (['80mm', '58mm', 'a4'].includes(sp.format ?? '') ? sp.format : '80mm') as '80mm' | '58mm' | 'a4';
  const kind = sp.kind === 'kitchen' ? 'kitchen_ticket' : 'customer_receipt';
  const data = await getReceiptData(id, kind);
  if (!data) notFound();
  const { count } = await adminDb().from('printer_jobs').select('id', { count: 'exact', head: true }).eq('order_id', id).eq('kind', kind).eq('status', 'done');
  const ar = (await getLocale()) === 'ar';
  return (
    <div className="min-h-dvh bg-sand-300/40 py-6 print:bg-white print:py-0">
      <PrintControls orderId={id} kind={kind} format={format} canReprint={staff.permissions.has('invoices.reprint') || kind === 'kitchen_ticket'} alreadyPrinted={(count ?? 0) > 0}
        labels={ar ? { browser: 'طباعة / PDF', usb: 'طابعة USB', bt: 'طابعة بلوتوث', lan: 'طابعة الشبكة', reprintDenied: 'تمت طباعة هذه الفاتورة. إعادة الطباعة تحتاج صلاحية.', queued: 'أُرسلت لجسر الطباعة' }
          : { browser: 'Print / PDF', usb: 'USB printer', bt: 'Bluetooth printer', lan: 'Network printer', reprintDenied: 'Already printed. Reprinting needs permission.', queued: 'Sent to the print bridge' }} />
      <div className="mx-auto w-fit bg-white p-3 shadow-lift print:p-0 print:shadow-none"><Receipt d={data} format={format} /></div>
    </div>
  );
}
