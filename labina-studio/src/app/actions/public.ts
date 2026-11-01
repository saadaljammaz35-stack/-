"use server";

import { getPublicClient } from "@/lib/supabase/public";
import { getSiteData } from "@/lib/data/public";
import { bookingInputSchema, contactInputSchema, fieldErrors, type BookingInput, type ContactInput } from "@/lib/validation";
import { errorMessage, isKnownError } from "@/lib/errors";
import {
  adminBookingAlertEmail,
  adminContactAlertEmail,
  bookingReceivedEmail,
  sendEmail,
  studioAlertRecipient,
} from "@/lib/email";
import type { ActionResult, BookingPayload } from "@/lib/types";

export type BookingSuccess = {
  reference: string;
  manageToken: string;
  serviceName: string;
  date: string;
  start: string;
  end: string;
  emailSent: boolean;
};

function rpcError(error: { message: string; code?: string }, scope: string): { ok: false; error: string; code?: string } {
  const code = error.message?.trim();
  if (!isKnownError(code)) console.error(`[${scope}]`, error);
  return { ok: false, error: errorMessage(code), code };
}

export async function createBooking(input: BookingInput): Promise<ActionResult<BookingSuccess>> {
  const parsed = bookingInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "يرجى مراجعة الحقول المظللة.", fieldErrors: fieldErrors(parsed.error) };
  }
  const v = parsed.data;

  const supabase = getPublicClient();
  if (!supabase) return { ok: false, error: errorMessage("NOT_CONFIGURED"), code: "NOT_CONFIGURED" };

  const { data, error } = await supabase.rpc("create_booking", {
    p_service_id: v.serviceId,
    p_date: v.date,
    p_start: v.time,
    p_name: v.name,
    p_phone: v.phone,
    p_email: v.email,
    p_children: v.children,
    p_notes: v.notes,
  });
  if (error) return rpcError(error, "create_booking");

  const booking = data as unknown as BookingPayload;
  const site = await getSiteData();
  const studioEmail = studioAlertRecipient(site.contact.email);

  const [customerMail] = await Promise.all([
    site.booking.send_customer_emails && booking.customer_email
      ? sendEmail({ to: booking.customer_email, ...bookingReceivedEmail(booking), replyTo: site.contact.email })
      : Promise.resolve({ sent: false }),
    studioEmail ? sendEmail({ to: studioEmail, ...adminBookingAlertEmail(booking, "new") }) : Promise.resolve({ sent: false }),
  ]);

  return {
    ok: true,
    data: {
      reference: booking.reference,
      manageToken: booking.manage_token ?? "",
      serviceName: booking.service_name,
      date: booking.booking_date,
      start: booking.start_time,
      end: booking.end_time,
      emailSent: customerMail.sent,
    },
  };
}

export async function cancelBookingByToken(token: string, reason: string): Promise<ActionResult> {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return { ok: false, error: errorMessage("NOT_FOUND") };
  const supabase = getPublicClient();
  if (!supabase) return { ok: false, error: errorMessage("NOT_CONFIGURED") };

  const { data, error } = await supabase.rpc("cancel_booking_by_token", {
    p_token: token,
    p_reason: (reason ?? "").slice(0, 500),
  });
  if (error) return rpcError(error, "cancel_booking");

  const site = await getSiteData();
  const studioEmail = studioAlertRecipient(site.contact.email);
  if (studioEmail) {
    await sendEmail({ to: studioEmail, ...adminBookingAlertEmail(data as unknown as BookingPayload, "cancelled_by_customer") });
  }
  return { ok: true, message: "تم إلغاء الحجز." };
}

export async function submitContactMessage(input: ContactInput): Promise<ActionResult> {
  const parsed = contactInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "يرجى مراجعة الحقول المظللة.", fieldErrors: fieldErrors(parsed.error) };
  }
  const v = parsed.data;
  const supabase = getPublicClient();
  if (!supabase) return { ok: false, error: errorMessage("NOT_CONFIGURED") };

  const { error } = await supabase.rpc("submit_contact_message", {
    p_name: v.name,
    p_phone: v.phone,
    p_email: v.email,
    p_subject: v.subject,
    p_message: v.message,
  });
  if (error) return rpcError(error, "contact");

  const site = await getSiteData();
  const studioEmail = studioAlertRecipient(site.contact.email);
  if (studioEmail) {
    await sendEmail({ to: studioEmail, ...adminContactAlertEmail(v), replyTo: v.email || undefined });
  }
  return { ok: true, message: "وصلتنا رسالتك، وسنرد عليك قريباً." };
}
