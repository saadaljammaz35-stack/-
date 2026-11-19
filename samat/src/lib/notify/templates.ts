import { formatMoney, type Locale } from '@/lib/money';

export type CustomerEvent = 'order_received' | 'accepted' | 'preparing' | 'ready' | 'rejected' | 'cancelled' | 'refunded';
export type StaffEvent = 'new_order' | 'low_stock' | 'payment_problem' | 'service_problem';

export interface OrderForMessage {
  id: string;
  order_number: number;
  pickup_code: string;
  tracking_token: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  locale: Locale;
  status: string;
  payment_status: string;
  subtotal: number;
  discount_total: number;
  vat_amount: number;
  total: number;
  notes: string | null;
  reject_reason: string | null;
  created_at: string;
  invoice_number?: string | null;
  items: {
    product_name_ar: string;
    product_name_en: string;
    quantity: number;
    line_total: number;
    bread_name_ar: string | null;
    bread_name_en: string | null;
    notes: string | null;
    customizations: { kind: string; action: string; quantity: number; name_ar: string; name_en: string; total_price: number }[];
  }[];
}

const customerCopy: Record<CustomerEvent, Record<Locale, { subject: string; line: string }>> = {
  order_received: {
    ar: { subject: 'وصلنا طلبك يا هلا!', line: 'وصلنا طلبك يا هلا! ننتظر تأكيد المطعم.' },
    en: { subject: 'We got your order!', line: 'We got your order! Waiting for the restaurant to confirm.' },
  },
  accepted: {
    ar: { subject: 'تم قبول طلبك', line: 'تم قبول طلبك، وبدأنا نجهزه.' },
    en: { subject: 'Your order was accepted', line: 'Your order has been accepted and we have started preparing it.' },
  },
  preparing: {
    ar: { subject: 'طلبك تحت التجهيز', line: 'طلبك تحت التجهيز، بالعافية عليك مقدماً.' },
    en: { subject: 'Your order is being prepared', line: 'Your order is being prepared — enjoy in advance!' },
  },
  ready: {
    ar: { subject: 'طلبك جاهز يا هلا', line: 'طلبك جاهز يا هلا، تفضل استلمه من الفرع.' },
    en: { subject: 'Your order is ready', line: 'Your order is ready — please pick it up from the branch.' },
  },
  rejected: {
    ar: { subject: 'نعتذر منك', line: 'نعتذر منك، ما قدرنا نقبل طلبك. راجع تفاصيل الطلب لمعرفة السبب.' },
    en: { subject: 'We are sorry', line: 'We are sorry, we could not accept your order. See the order details for the reason.' },
  },
  cancelled: {
    ar: { subject: 'انلغى طلبك', line: 'انلغى طلبك، وبنرجّع لك المبلغ عبر طريقة الدفع.' },
    en: { subject: 'Your order was cancelled', line: 'Your order was cancelled and will be refunded to your payment method.' },
  },
  refunded: {
    ar: { subject: 'تم استرجاع المبلغ', line: 'تم استرجاع مبلغ طلبك عبر بوابة الدفع. قد يستغرق ظهوره في حسابك بضعة أيام حسب البنك.' },
    en: { subject: 'Your refund was processed', line: 'Your refund has been processed by the payment gateway. It may take a few days to appear, depending on your bank.' },
  },
};

export function customerSms(event: CustomerEvent, o: OrderForMessage, trackUrl: string): string {
  const c = customerCopy[event][o.locale];
  const prefix = o.locale === 'ar' ? `سماط #${o.order_number}` : `SAMAT #${o.order_number}`;
  return `${prefix}: ${c.line} ${trackUrl}`;
}

function esc(s: string | null | undefined): string {
  return (s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
}

function itemsHtml(o: OrderForMessage, locale: Locale): string {
  const n = (r: { name_ar: string; name_en: string }) => (locale === 'ar' ? r.name_ar : r.name_en);
  return o.items
    .map((i) => {
      const parts: string[] = [];
      const bread = locale === 'ar' ? i.bread_name_ar : i.bread_name_en;
      if (bread) parts.push(esc(bread));
      for (const c of i.customizations) {
        if (c.kind === 'bread') continue;
        if (c.action === 'removed') parts.push(`<span style="color:#B8502C">${locale === 'ar' ? 'بدون' : 'No'} ${esc(n(c))}</span>`);
        else if (c.action === 'added' || c.action === 'extra') parts.push(`+ ${esc(n(c))}${c.quantity > 1 ? ` ×${c.quantity}` : ''}`);
        else if (c.action === 'selected') parts.push(esc(n(c)));
        else if (c.kind === 'sauce') parts.push(esc(n(c)));
      }
      if (i.notes) parts.push(`<em>“${esc(i.notes)}”</em>`);
      return `<tr>
        <td style="padding:10px 0;border-bottom:1px solid #E6DCC8;vertical-align:top">
          <strong>${i.quantity}× ${esc(locale === 'ar' ? i.product_name_ar : i.product_name_en)}</strong>
          ${parts.length ? `<div style="color:#6B5A4E;font-size:13px;margin-top:4px">${parts.join(' · ')}</div>` : ''}
        </td>
        <td style="padding:10px 0;border-bottom:1px solid #E6DCC8;vertical-align:top;white-space:nowrap;text-align:${locale === 'ar' ? 'left' : 'right'}">${formatMoney(i.line_total, locale)}</td>
      </tr>`;
    })
    .join('');
}

function layout(locale: Locale, siteUrl: string, title: string, body: string): string {
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  return `<!doctype html><html lang="${locale}" dir="${dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(title)}</title></head>
<body style="margin:0;background:#F2EEE3;font-family:Tahoma,Arial,sans-serif;color:#2F231C">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2EEE3;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FBF8F1;border-radius:20px;overflow:hidden;border:1px solid #E6DCC8">
<tr><td style="background:#2F231C;padding:22px;text-align:center"><img src="${siteUrl}/brand/samat-logo-cream.png" alt="SAMAT سماط" width="96" style="display:inline-block"></td></tr>
<tr><td style="padding:28px 26px;direction:${dir};text-align:${locale === 'ar' ? 'right' : 'left'};line-height:1.7">${body}</td></tr>
<tr><td style="padding:16px 26px;background:#EFE7D8;color:#6B5A4E;font-size:12px;text-align:center">SAMAT · سماط — ${locale === 'ar' ? 'استلام من الفرع' : 'Pickup at the branch'}</td></tr>
</table></td></tr></table></body></html>`;
}

export function customerEmail(event: CustomerEvent, o: OrderForMessage, siteUrl: string) {
  const L = o.locale;
  const c = customerCopy[event][L];
  const track = `${siteUrl}/t/${o.tracking_token}`;
  const reason = event === 'rejected' && o.reject_reason
    ? `<p style="background:#F6E3DA;border-radius:12px;padding:12px 14px">${L === 'ar' ? 'السبب' : 'Reason'}: ${esc(o.reject_reason)}</p>` : '';
  const refundNote = event === 'rejected' && ['paid', 'authorized', 'refund_pending'].includes(o.payment_status)
    ? `<p>${L === 'ar' ? 'بنرجّع لك المبلغ كامل، ونبلغك أول ما تأكد بوابة الدفع الاسترجاع.' : 'You will be refunded in full; we will let you know as soon as the payment gateway confirms it.'}</p>` : '';
  const body = `
    <h1 style="font-size:22px;margin:0 0 6px">${esc(c.subject)}</h1>
    <p style="margin:0 0 18px;font-size:15px">${esc(c.line)}</p>
    ${reason}${refundNote}
    <table role="presentation" width="100%" style="background:#F2EEE3;border-radius:14px;padding:14px;margin:0 0 16px"><tr>
      <td><div style="font-size:12px;color:#6B5A4E">${L === 'ar' ? 'رقم الطلب' : 'Order no.'}</div><div style="font-size:24px;font-weight:bold">#${o.order_number}</div></td>
      <td style="text-align:center"><div style="font-size:12px;color:#6B5A4E">${L === 'ar' ? 'رمز الاستلام' : 'Pickup code'}</div><div style="font-size:24px;font-weight:bold;letter-spacing:3px">${esc(o.pickup_code)}</div></td>
    </tr></table>
    <table role="presentation" width="100%" style="font-size:14px">${itemsHtml(o, L)}
      <tr><td style="padding-top:12px"><strong>${L === 'ar' ? 'الإجمالي (شامل الضريبة)' : 'Total (VAT incl.)'}</strong></td>
      <td style="padding-top:12px;text-align:${L === 'ar' ? 'left' : 'right'}"><strong>${formatMoney(o.total, L)}</strong></td></tr>
    </table>
    <p style="text-align:center;margin:24px 0 4px"><a href="${track}" style="display:inline-block;background:#2F231C;color:#F7F3EA;text-decoration:none;padding:13px 26px;border-radius:999px;font-weight:bold">${L === 'ar' ? 'تابع طلبك' : 'Track your order'}</a></p>`;
  const text = `${c.line}\n#${o.order_number} — ${o.pickup_code}\n${formatMoney(o.total, L)}\n${track}`;
  return { subject: `${c.subject} — #${o.order_number}`, html: layout(L, siteUrl, c.subject, body), text };
}

/** E-mail to the restaurant for every new paid order (Arabic first, then English). */
export function staffNewOrderEmail(o: OrderForMessage, siteUrl: string) {
  const admin = `${siteUrl}/admin/orders/${o.id}`;
  const payment = ({ paid: 'مدفوع / Paid', authorized: 'مفوّض (بانتظار التحصيل) / Authorised', not_required: 'لا يتطلب دفع / No payment due' } as Record<string, string>)[o.payment_status] ?? o.payment_status;
  const body = `
    <h1 style="font-size:22px;margin:0 0 4px">طلب جديد #${o.order_number} — بانتظار موافقتك</h1>
    <p style="margin:0 0 16px;color:#6B5A4E">New order #${o.order_number} — awaiting your approval</p>
    <table role="presentation" width="100%" style="font-size:14px;background:#F2EEE3;border-radius:14px;padding:12px;margin-bottom:14px">
      <tr><td>العميل / Customer</td><td><strong>${esc(o.customer_name)}</strong></td></tr>
      <tr><td>الجوال / Mobile</td><td dir="ltr"><strong>${esc(o.customer_phone)}</strong></td></tr>
      ${o.customer_email ? `<tr><td>البريد / Email</td><td>${esc(o.customer_email)}</td></tr>` : ''}
      <tr><td>وقت الطلب / Placed</td><td>${new Date(o.created_at).toLocaleString('ar-SA', { timeZone: 'Asia/Riyadh' })}</td></tr>
      <tr><td>حالة الدفع / Payment</td><td><strong>${payment}</strong></td></tr>
      ${o.invoice_number ? `<tr><td>رقم الفاتورة / Invoice</td><td>${esc(o.invoice_number)}</td></tr>` : ''}
      <tr><td>رمز الاستلام / Pickup</td><td><strong>${esc(o.pickup_code)}</strong></td></tr>
    </table>
    <table role="presentation" width="100%" style="font-size:14px">${itemsHtml(o, 'ar')}
      ${o.discount_total ? `<tr><td>الخصم / Discount</td><td style="text-align:left">− ${formatMoney(o.discount_total, 'ar')}</td></tr>` : ''}
      <tr><td>الضريبة / VAT</td><td style="text-align:left">${formatMoney(o.vat_amount, 'ar')}</td></tr>
      <tr><td><strong>الإجمالي / Total</strong></td><td style="text-align:left"><strong>${formatMoney(o.total, 'ar')}</strong></td></tr>
    </table>
    ${o.notes ? `<p style="background:#FFF4D6;border-radius:12px;padding:10px 12px">ملاحظات / Notes: ${esc(o.notes)}</p>` : ''}
    <p style="text-align:center;margin:22px 0 0"><a href="${admin}" style="display:inline-block;background:#2F231C;color:#F7F3EA;text-decoration:none;padding:13px 26px;border-radius:999px;font-weight:bold">راجع الطلب واقبله / Review order</a></p>`;
  return {
    subject: `🔔 طلب جديد #${o.order_number} — ${formatMoney(o.total, 'ar')}`,
    html: layout('ar', siteUrl, 'طلب جديد', body),
    text: `New order #${o.order_number} from ${o.customer_name} (${o.customer_phone}) — ${formatMoney(o.total, 'en')}. ${admin}`,
  };
}

export function staffAlertEmail(kind: StaffEvent, title: string, lines: string[], siteUrl: string) {
  const body = `<h1 style="font-size:20px;margin:0 0 12px">${esc(title)}</h1>${lines.map((l) => `<p style="margin:0 0 8px">${esc(l)}</p>`).join('')}
    <p style="margin-top:18px"><a href="${siteUrl}/admin" style="color:#B8502C">${siteUrl}/admin</a></p>`;
  return { subject: `SAMAT — ${title}`, html: layout('ar', siteUrl, title, body), text: [title, ...lines].join('\n') };
}
