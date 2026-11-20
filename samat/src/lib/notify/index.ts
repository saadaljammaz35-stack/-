import 'server-only';
import { adminDb } from '@/lib/supabase/admin';
import { env } from '@/lib/env';
import { sendPush } from './push';
import { emailConfigured, sendEmail, sendSms, sendWhatsAppTemplate, smsConfigured, whatsappConfigured, type SendResult } from './channels';
import { customerEmail, customerSms, staffAlertEmail, staffNewOrderEmail, type CustomerEvent, type OrderForMessage, type StaffEvent } from './templates';

type Channel = 'email' | 'sms' | 'whatsapp';
type Payload =
  | { kind: 'email'; subject: string; html: string; text: string }
  | { kind: 'sms'; body: string }
  | { kind: 'whatsapp'; template: string; lang: string; params: string[] };

async function dispatch(channel: Channel, recipient: string, p: Payload): Promise<SendResult> {
  if (p.kind === 'email') return sendEmail(recipient, p.subject, p.html, p.text);
  if (p.kind === 'sms') return sendSms(recipient, p.body);
  return sendWhatsAppTemplate(recipient, p.template, p.lang, p.params);
}

/**
 * Records the notification under a unique dedupe key, then sends it. A repeated webhook/callback
 * hits the unique key and sends nothing — each event reaches each channel at most once.
 */
async function deliver(row: {
  dedupe_key: string;
  order_id: string | null;
  audience: 'customer' | 'staff';
  channel: Channel;
  template: string;
  recipient: string;
  locale: string;
  payload: Payload;
  configured: boolean;
}): Promise<void> {
  const db = adminDb();
  const { configured, ...insert } = row;
  const { data, error } = await db
    .from('notifications')
    .upsert({ ...insert, status: configured ? 'pending' : 'skipped', last_error: configured ? null : `${row.channel} not configured` },
      { onConflict: 'dedupe_key', ignoreDuplicates: true })
    .select('id');
  if (error) {
    console.error('[notify] insert', error.message);
    return;
  }
  if (!data?.length || !configured) return; // duplicate, or channel not set up (recorded as skipped)
  const id = data[0].id;
  const result = await dispatch(row.channel, row.recipient, row.payload);
  await db.from('notifications').update({
    status: result.status,
    attempts: 1,
    last_error: result.error ?? null,
    provider_message_id: result.providerId ?? null,
    sent_at: result.status === 'sent' ? new Date().toISOString() : null,
  }).eq('id', id);
}

export async function loadOrderForMessage(orderId: string): Promise<OrderForMessage | null> {
  const { data } = await adminDb()
    .from('orders')
    .select(`id, order_number, pickup_code, tracking_token, customer_name, customer_phone, customer_email, locale, status,
      payment_status, subtotal, discount_total, vat_amount, total, notes, reject_reason, created_at,
      invoices(invoice_number),
      items:order_items(product_name_ar, product_name_en, quantity, line_total, bread_name_ar, bread_name_en, notes, sort_order,
        customizations:order_customizations(kind, action, quantity, name_ar, name_en, total_price, sort_order))`)
    .eq('id', orderId)
    .maybeSingle();
  if (!data) return null;
  const d = data as unknown as OrderForMessage & { invoices: { invoice_number: string }[] | { invoice_number: string } | null };
  const inv = Array.isArray(d.invoices) ? d.invoices[0] : d.invoices;
  return { ...d, invoice_number: inv?.invoice_number ?? null };
}

const WA_TEMPLATES: Partial<Record<CustomerEvent, string>> = {
  order_received: 'samat_order_received',
  accepted: 'samat_order_accepted',
  preparing: 'samat_order_preparing',
  ready: 'samat_order_ready',
  rejected: 'samat_order_rejected',
};

const PUSH_TEXT: Partial<Record<CustomerEvent, { ar: [string, string]; en: [string, string] }>> = {
  accepted: { ar: ['تم قبول طلبك', 'طلبك #{n} انقبل، وبنبدأ نجهزه.'], en: ['Order accepted', 'Order #{n} is accepted and will be prepared.'] },
  ready: { ar: ['طلبك جاهز 🎉', 'طلبك #{n} جاهز، تفضل استلمه من الفرع.'], en: ['Your order is ready 🎉', 'Order #{n} is ready for pickup.'] },
  rejected: { ar: ['بخصوص طلبك', 'نعتذر، ما قدرنا نقبل طلبك #{n}.'], en: ['About your order', 'Sorry, we could not accept order #{n}.'] },
};

export async function notifyCustomer(orderId: string, event: CustomerEvent): Promise<void> {
  const o = await loadOrderForMessage(orderId);
  if (!o) return;
  const site = env.siteUrl;
  const jobs: Promise<void>[] = [];
  // browser notification on the customer's phone (if they asked for it on the tracking page)
  const pushText = PUSH_TEXT[event]?.[o.locale === 'en' ? 'en' : 'ar'];
  if (pushText) jobs.push(sendPush({ orderId: o.id }, { title: pushText[0], body: pushText[1].replace('{n}', String(o.order_number)), url: `/t/${o.tracking_token}`, tag: `order-${o.id}` }).then(() => undefined));
  if (o.customer_email) {
    const m = customerEmail(event, o, site);
    jobs.push(deliver({ dedupe_key: `${o.id}:${event}:email`, order_id: o.id, audience: 'customer', channel: 'email', template: event,
      recipient: o.customer_email, locale: o.locale, payload: { kind: 'email', ...m }, configured: emailConfigured() }));
  }
  jobs.push(deliver({ dedupe_key: `${o.id}:${event}:sms`, order_id: o.id, audience: 'customer', channel: 'sms', template: event,
    recipient: o.customer_phone, locale: o.locale, payload: { kind: 'sms', body: customerSms(event, o, `${site}/t/${o.tracking_token}`) },
    configured: smsConfigured() }));
  const wa = WA_TEMPLATES[event];
  if (wa) {
    jobs.push(deliver({ dedupe_key: `${o.id}:${event}:whatsapp`, order_id: o.id, audience: 'customer', channel: 'whatsapp', template: event,
      recipient: o.customer_phone, locale: o.locale,
      payload: { kind: 'whatsapp', template: wa, lang: o.locale === 'ar' ? env.whatsapp.langAr : env.whatsapp.langEn, params: [String(o.order_number)] },
      configured: whatsappConfigured() }));
  }
  await Promise.allSettled(jobs);
}

async function staffEmails(): Promise<string[]> {
  const { data } = await adminDb().from('store_settings').select('admin_notification_emails').eq('id', 1).single();
  const list = (data?.admin_notification_emails ?? []) as string[];
  if (!list.length) return env.superAdminEmails;
  return list;
}

export async function notifyStaffNewOrder(orderId: string): Promise<void> {
  const o = await loadOrderForMessage(orderId);
  if (!o) return;
  const m = staffNewOrderEmail(o, env.siteUrl);
  await sendPush({ staff: true }, { title: `طلب جديد #${o.order_number}`, body: `${o.customer_name} — بانتظار موافقتك`, url: `/admin/orders/${o.id}`, tag: `new-${o.id}` }).catch(() => 0);
  await Promise.allSettled((await staffEmails()).map((to) =>
    deliver({ dedupe_key: `${o.id}:new_order:email:${to.toLowerCase()}`, order_id: o.id, audience: 'staff', channel: 'email',
      template: 'new_order', recipient: to, locale: 'ar', payload: { kind: 'email', ...m }, configured: emailConfigured() })));
}

/** Operational alert to the restaurant (low stock, payment problem, service problem). */
export async function notifyStaffAlert(kind: StaffEvent, dedupeKey: string, title: string, lines: string[], orderId: string | null = null) {
  const m = staffAlertEmail(kind, title, lines, env.siteUrl);
  await Promise.allSettled((await staffEmails()).map((to) =>
    deliver({ dedupe_key: `${kind}:${dedupeKey}:${to.toLowerCase()}`, order_id: orderId, audience: 'staff', channel: 'email',
      template: kind, recipient: to, locale: 'ar', payload: { kind: 'email', ...m }, configured: emailConfigured() })));
}

/** Cron: retry failed sends (max 3 attempts, within 24h). */
export async function retryFailedNotifications(): Promise<number> {
  const db = adminDb();
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { data } = await db.from('notifications').select('id, channel, recipient, payload, attempts')
    .eq('status', 'failed').lt('attempts', 3).gt('created_at', since).limit(50);
  let n = 0;
  for (const row of data ?? []) {
    const r = await dispatch(row.channel as Channel, row.recipient, row.payload as Payload);
    await db.from('notifications').update({
      status: r.status, attempts: row.attempts + 1, last_error: r.error ?? null, provider_message_id: r.providerId ?? null,
      sent_at: r.status === 'sent' ? new Date().toISOString() : null,
    }).eq('id', row.id);
    if (r.status === 'sent') n++;
  }
  return n;
}
