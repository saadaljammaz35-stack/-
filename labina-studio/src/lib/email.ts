import "server-only";
import { formatDate, formatTime } from "./format";
import { SITE_NAME } from "./constants";
import { env } from "./env";

type SendArgs = { to: string; subject: string; html: string; replyTo?: string };

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.NOTIFY_FROM_EMAIL);
}

/** Sends through Resend's HTTP API. Never throws: failures are logged and reported. */
export async function sendEmail({ to, subject, html, replyTo }: SendArgs): Promise<{ sent: boolean }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFY_FROM_EMAIL;
  if (!key || !from || !to) return { sent: false };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, html, reply_to: replyTo || undefined }),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error("[email] Resend error", res.status, await res.text().catch(() => ""));
      return { sent: false };
    }
    return { sent: true };
  } catch (error) {
    console.error("[email] send failed", error);
    return { sent: false };
  }
}

export function escapeHtml(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function layout(title: string, body: string): string {
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;background:#F5EEDC;font-family:Tahoma,Arial,sans-serif;color:#2A1A35">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5EEDC;padding:32px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FBF7EE;border-radius:24px;overflow:hidden">
<tr><td style="padding:24px 28px;background:#49285D;color:#F5EEDC">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="width:14px;height:14px;background:#DE7968;border-radius:4px"></td><td style="width:6px"></td>
<td style="width:14px;height:22px;background:#EFC95E;border-radius:4px"></td><td style="width:6px"></td>
<td style="width:14px;height:30px;background:#929FCC;border-radius:4px"></td><td style="width:12px"></td>
<td style="font-size:22px;font-weight:bold">${SITE_NAME}</td></tr></table>
</td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 16px;font-size:22px;color:#49285D">${title}</h1>
${body}
</td></tr>
<tr><td style="padding:16px 28px;background:#EDE2C8;font-size:12px;color:#5E4E68">${SITE_NAME} · ${escapeHtml(env.siteUrl.replace(/^https?:\/\//, ""))}</td></tr>
</table></td></tr></table></body></html>`;
}

function rows(items: [string, string][]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:8px 0 20px">
${items
  .map(
    ([k, v]) =>
      `<tr><td style="padding:10px 0;border-bottom:1px solid #EDE2C8;color:#5E4E68;width:38%">${k}</td><td style="padding:10px 0;border-bottom:1px solid #EDE2C8;font-weight:bold">${v}</td></tr>`,
  )
  .join("")}
</table>`;
}

function button(href: string, label: string, color = "#DE7968"): string {
  return `<a href="${escapeHtml(href)}" style="display:inline-block;background:${color};color:#FBF7EE;text-decoration:none;padding:12px 22px;border-radius:14px;font-weight:bold">${label}</a>`;
}

export type BookingEmailData = {
  reference: string;
  service_name: string;
  booking_date: string;
  start_time: string;
  customer_name: string;
  customer_phone?: string;
  customer_email?: string | null;
  children_count: number;
  notes?: string | null;
  manage_token?: string;
};

function bookingRows(b: BookingEmailData, withContact = false): string {
  const items: [string, string][] = [
    ["رقم الحجز", escapeHtml(b.reference)],
    ["الجلسة", escapeHtml(b.service_name)],
    ["التاريخ", escapeHtml(formatDate(b.booking_date))],
    ["الوقت", escapeHtml(formatTime(b.start_time))],
    ["عدد الأطفال", String(b.children_count)],
  ];
  if (withContact) {
    items.push(["الاسم", escapeHtml(b.customer_name)]);
    if (b.customer_phone) items.push(["الجوال", escapeHtml(b.customer_phone)]);
    if (b.customer_email) items.push(["البريد", escapeHtml(b.customer_email)]);
    if (b.notes) items.push(["ملاحظات", escapeHtml(b.notes)]);
  }
  return rows(items);
}

export function manageUrl(token?: string): string {
  return token ? `${env.siteUrl}/booking/manage/${token}` : env.siteUrl;
}

export function bookingReceivedEmail(b: BookingEmailData) {
  return {
    subject: `استلمنا طلب حجزك ${b.reference} | ${SITE_NAME}`,
    html: layout(
      `أهلاً ${escapeHtml(b.customer_name)}، استلمنا طلب حجزك`,
      `<p style="line-height:1.9;margin:0 0 8px">سنتواصل معك قريباً لتأكيد الموعد. هذه تفاصيل طلبك:</p>
${bookingRows(b)}
<p style="line-height:1.9;margin:0 0 18px">يمكنك متابعة حجزك أو إلغاؤه من الرابط الخاص بك:</p>
${button(manageUrl(b.manage_token), "إدارة الحجز")}`,
    ),
  };
}

export function bookingStatusEmail(b: BookingEmailData, status: "confirmed" | "cancelled" | "rescheduled") {
  const titles = {
    confirmed: "تم تأكيد موعدك",
    cancelled: "تم إلغاء الحجز",
    rescheduled: "تم تعديل موعد جلستك",
  } as const;
  const intros = {
    confirmed: "يسعدنا تأكيد جلستك. نراكم في الموعد التالي:",
    cancelled: "نود إعلامك بأن الحجز التالي أصبح ملغى. يسعدنا ترتيب موعد جديد متى أردت.",
    rescheduled: "تم تحديث موعد جلستك. هذه التفاصيل الجديدة:",
  } as const;
  return {
    subject: `${titles[status]} ${b.reference} | ${SITE_NAME}`,
    html: layout(
      `${titles[status]}`,
      `<p style="line-height:1.9;margin:0 0 8px">أهلاً ${escapeHtml(b.customer_name)}، ${intros[status]}</p>
${bookingRows(b)}
${status === "cancelled" ? button(`${env.siteUrl}/booking`, "احجز موعداً جديداً") : button(manageUrl(b.manage_token), "عرض الحجز")}`,
    ),
  };
}

export function adminBookingAlertEmail(b: BookingEmailData, kind: "new" | "cancelled_by_customer") {
  const title = kind === "new" ? "حجز جديد بانتظار التأكيد" : "ألغى العميل حجزه";
  return {
    subject: `${title}: ${b.reference}`,
    html: layout(title, `${bookingRows(b, true)}${button(`${env.siteUrl}/admin/bookings`, "فتح لوحة التحكم", "#49285D")}`),
  };
}

export function adminContactAlertEmail(m: { name: string; phone?: string; email?: string; subject?: string; message: string }) {
  const items: [string, string][] = [["الاسم", escapeHtml(m.name)]];
  if (m.phone) items.push(["الجوال", escapeHtml(m.phone)]);
  if (m.email) items.push(["البريد", escapeHtml(m.email)]);
  if (m.subject) items.push(["الموضوع", escapeHtml(m.subject)]);
  return {
    subject: `رسالة جديدة من ${m.name}`,
    html: layout(
      "رسالة جديدة من نموذج التواصل",
      `${rows(items)}<p style="line-height:1.9;white-space:pre-wrap;background:#F5EEDC;padding:16px;border-radius:14px">${escapeHtml(m.message)}</p>
${button(`${env.siteUrl}/admin/messages`, "فتح الرسائل", "#49285D")}`,
    ),
  };
}

/** Where studio alerts go: STUDIO_NOTIFY_EMAIL, or the public contact email */
export function studioAlertRecipient(contactEmail: string): string {
  return process.env.STUDIO_NOTIFY_EMAIL || contactEmail;
}
