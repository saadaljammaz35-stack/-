import 'server-only';
import QRCode from 'qrcode';
import { adminDb } from '@/lib/supabase/admin';
import { zatcaTlvBase64 } from '@/lib/invoice/zatca';

export interface ReceiptData {
  kind: 'customer_receipt' | 'kitchen_ticket';
  seller: { name: string; nameEn: string; vat: string | null; cr: string | null; address: string | null; phone: string | null; footerAr: string | null; footerEn: string | null };
  order: { id: string; number: number; pickupCode: string; createdAt: string; customerName: string; customerPhone: string; status: string; paymentStatus: string; notes: string | null };
  invoice: { number: string; issuedAt: string; status: string } | null;
  items: { qty: number; nameAr: string; nameEn: string; lineTotal: number; unitPrice: number; bread: string | null; mods: { action: string; nameAr: string; nameEn: string; qty: number; price: number }[]; notes: string | null }[];
  totals: { subtotal: number; discount: number; vat: number; vatRate: number; total: number; inclusive: boolean };
  zatcaQrSvg: string | null;
}

export async function getReceiptData(orderId: string, kind: ReceiptData['kind']): Promise<ReceiptData | null> {
  const db = adminDb();
  const [{ data: o }, { data: s }] = await Promise.all([
    db.from('orders').select(`id, order_number, pickup_code, created_at, customer_name, customer_phone, status, payment_status, notes, subtotal, discount_total,
      vat_amount, vat_rate_bps, prices_include_vat, total, invoices(invoice_number, issued_at, status, seller_name, vat_number),
      order_items(product_name_ar, product_name_en, quantity, unit_price, line_total, bread_name_ar, notes, sort_order,
        order_customizations(kind, action, quantity, name_ar, name_en, total_price, sort_order))`).eq('id', orderId).maybeSingle(),
    db.from('store_settings').select('legal_name, branch_name_ar, branch_name_en, vat_number, cr_number, address_ar, phone, invoice_footer_ar, invoice_footer_en').eq('id', 1).single(),
  ]);
  if (!o || !s) return null;
  const inv = Array.isArray(o.invoices) ? o.invoices[0] : o.invoices;
  const sellerName = inv?.seller_name ?? s.legal_name ?? s.branch_name_ar;
  const vat = inv?.vat_number ?? s.vat_number;
  let zatcaQrSvg: string | null = null;
  if (inv && vat && kind === 'customer_receipt') {
    const tlv = zatcaTlvBase64({ sellerName, vatNumber: vat, timestamp: new Date(inv.issued_at), total: o.total, vat: o.vat_amount });
    zatcaQrSvg = await QRCode.toString(tlv, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' });
  }
  return {
    kind,
    seller: { name: sellerName, nameEn: s.branch_name_en, vat, cr: s.cr_number, address: s.address_ar, phone: s.phone, footerAr: s.invoice_footer_ar, footerEn: s.invoice_footer_en },
    order: { id: o.id, number: o.order_number, pickupCode: o.pickup_code, createdAt: o.created_at, customerName: o.customer_name, customerPhone: o.customer_phone, status: o.status, paymentStatus: o.payment_status, notes: o.notes },
    invoice: inv ? { number: inv.invoice_number, issuedAt: inv.issued_at, status: inv.status } : null,
    items: (o.order_items ?? []).sort((x, y) => x.sort_order - y.sort_order).map((i) => ({
      qty: i.quantity, nameAr: i.product_name_ar, nameEn: i.product_name_en, lineTotal: i.line_total, unitPrice: i.unit_price, bread: i.bread_name_ar, notes: i.notes,
      mods: (i.order_customizations ?? []).sort((x, y) => x.sort_order - y.sort_order).filter((c) => c.kind !== 'bread' && c.action !== 'included')
        .map((c) => ({ action: c.action, nameAr: c.name_ar, nameEn: c.name_en, qty: c.quantity, price: c.total_price })),
    })),
    totals: { subtotal: o.subtotal, discount: o.discount_total, vat: o.vat_amount, vatRate: o.vat_rate_bps, total: o.total, inclusive: o.prices_include_vat },
    zatcaQrSvg,
  };
}
