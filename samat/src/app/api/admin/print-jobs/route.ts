import { z } from 'zod';
import { requireStaff } from '@/lib/auth/staff';
import { adminDb } from '@/lib/supabase/admin';
import { AppError, errorResponse } from '@/lib/errors';

const Body = z.object({
  order_id: z.string().uuid(), kind: z.enum(['customer_receipt', 'kitchen_ticket']), format: z.enum(['80mm', '58mm', 'a4', 'escpos']),
  target: z.enum(['browser', 'lan', 'usb', 'bluetooth', 'pdf']), status: z.enum(['queued', 'done', 'failed']), error: z.string().max(300).optional(),
});

/** Records every print (and queues LAN prints for the bridge). Reprints need invoices.reprint. */
export async function POST(req: Request) {
  try {
    const me = await requireStaff('invoices.print');
    const b = Body.safeParse(await req.json());
    if (!b.success) throw new AppError('invalid_request');
    const db = adminDb();
    const { count } = await db.from('printer_jobs').select('id', { count: 'exact', head: true })
      .eq('order_id', b.data.order_id).eq('kind', b.data.kind).in('status', ['done', 'queued', 'printing']);
    const reprint = (count ?? 0) > 0;
    if (reprint && b.data.kind === 'customer_receipt' && !me.permissions.has('invoices.reprint')) throw new AppError('forbidden', 403);
    const { error } = await db.from('printer_jobs').insert({
      order_id: b.data.order_id, kind: b.data.kind, format: b.data.format, target: b.data.target, status: b.data.status,
      is_reprint: reprint, error: b.data.error ?? null, requested_by: me.userId, completed_at: b.data.status === 'done' ? new Date().toISOString() : null,
    });
    if (error) throw error;
    if (b.data.kind === 'customer_receipt' && b.data.status !== 'failed') {
      const { data: inv } = await db.from('invoices').select('id, print_count').eq('order_id', b.data.order_id).maybeSingle();
      if (inv) await db.from('invoices').update({ print_count: inv.print_count + 1 }).eq('id', inv.id);
    }
    return Response.json({ ok: true, reprint });
  } catch (e) {
    return errorResponse(e);
  }
}
