// appointment-notify: tells the customer that the clinic confirmed their
// appointment (see docs/API.md). customer_notified_at is written only after
// the message was actually stored (web) or accepted by Meta (WhatsApp).

import { type Db, dbFailure, requireMembership, requireUser, serviceClient, writeAudit } from "../_shared/db.ts";
import { z } from "../_shared/deps.ts";
import { confirmationText, formatAppointmentTime, type Language } from "../_shared/format.ts";
import { type Handler, HttpError, json, parse, readJson, type RequestContext } from "../_shared/http.ts";
import { log } from "../_shared/log.ts";
import { type StoredMessage, storeOutbound } from "../_shared/messages.ts";
import { rateLimit } from "../_shared/ratelimit.ts";
import { graphErrorCode, loadSender, type OutboundContent, sendAndRecord } from "../_shared/whatsapp/outbound.ts";
import { withinServiceWindow } from "../_shared/whatsapp/window.ts";

export interface Deps {
  db: Db;
  fetch: typeof fetch;
  now: () => Date;
}

export function liveDeps(): Deps {
  return { db: serviceClient(), fetch: globalThis.fetch, now: () => new Date() };
}

const Body = z.object({ appointment_request_id: z.uuid() });

interface AppointmentRow {
  id: string;
  organization_id: string;
  conversation_id: string | null;
  service_id: string | null;
  customer_name: string;
  status: string;
  scheduled_for: string | null;
}

interface ConversationRow {
  id: string;
  channel: "web" | "whatsapp";
  customer_wa_id: string | null;
  opted_out_at: string | null;
  last_inbound_at: string | null;
  language: Language | null;
}

interface ClinicRow {
  name: string;
  phone: string | null;
  default_language: Language;
}

interface SettingsRow {
  display_name_ar: string | null;
  display_name_en: string | null;
  address_ar: string | null;
  address_en: string | null;
  reception_phone: string | null;
  timezone: string | null;
}

interface ServiceRow {
  name_ar: string | null;
  name_en: string | null;
}

function notFound(): HttpError {
  return new HttpError(404, "not_found", "Appointment request not found");
}

async function requireMemberOr404(db: Db, userId: string, organizationId: string): Promise<void> {
  try {
    await requireMembership(db, userId, organizationId);
  } catch (error) {
    if (error instanceof HttpError && error.status === 403) throw notFound();
    throw error;
  }
}

async function one<T>(context: string, query: PromiseLike<{ data: unknown; error: unknown }>): Promise<T | null> {
  const { data, error } = await query;
  if (error) dbFailure(context, error as { message?: string; code?: string });
  return (data as T | null) ?? null;
}

/** The customer's language first, then the other language, then whatever the clinic has. */
function localized(language: Language, ar: string | null, en: string | null): string | null {
  return language === "ar" ? ar ?? en : en ?? ar;
}

export function createHandler(getDeps: () => Deps): Handler {
  return async (req: Request, ctx: RequestContext): Promise<Response> => {
    const { db, fetch, now } = getDeps();
    const user = await requireUser(req, db);
    const input = parse(Body, await readJson(req, 4 * 1024));
    // Each call can message a patient; bound it so a stuck button cannot spam them.
    await rateLimit(db, `notify:user:${user.id}`, 30, 600);

    const appointment = await one<AppointmentRow>(
      "appointment_lookup",
      db
        .from("appointment_requests")
        .select("id, organization_id, conversation_id, service_id, customer_name, status, scheduled_for")
        .eq("id", input.appointment_request_id)
        .maybeSingle(),
    );
    if (!appointment) throw notFound();
    const organizationId = appointment.organization_id;
    await requireMemberOr404(db, user.id, organizationId);

    if (appointment.status !== "confirmed" || appointment.scheduled_for === null) {
      throw new HttpError(409, "not_confirmed", "Confirm the request with an agreed time first");
    }
    const noChannel = () =>
      new HttpError(409, "no_channel", "This request has no chat or WhatsApp conversation. Call the customer.");
    if (appointment.conversation_id === null) throw noChannel();

    const conversation = await one<ConversationRow>(
      "conversation_lookup",
      db
        .from("conversations")
        .select("id, channel, customer_wa_id, opted_out_at, last_inbound_at, language")
        .eq("id", appointment.conversation_id)
        .eq("organization_id", organizationId)
        .maybeSingle(),
    );
    if (!conversation) throw noChannel();

    const clinic = await one<ClinicRow>(
      "clinic_lookup",
      db.from("organizations").select("name, phone, default_language").eq("id", organizationId).maybeSingle(),
    );
    if (!clinic) throw notFound();
    const settings = await one<SettingsRow>(
      "settings_lookup",
      db
        .from("clinic_settings")
        .select("display_name_ar, display_name_en, address_ar, address_en, reception_phone, timezone")
        .eq("organization_id", organizationId)
        .maybeSingle(),
    );
    const service = appointment.service_id === null ? null : await one<ServiceRow>(
      "service_lookup",
      db
        .from("clinic_services")
        .select("name_ar, name_en")
        .eq("id", appointment.service_id)
        .eq("organization_id", organizationId)
        .maybeSingle(),
    );

    const language: Language = conversation.language ?? clinic.default_language;
    const { date, time } = formatAppointmentTime(appointment.scheduled_for, language, settings?.timezone ?? undefined);
    const text = confirmationText({
      language,
      clinicName: localized(language, settings?.display_name_ar ?? null, settings?.display_name_en ?? null) ??
        clinic.name,
      customerName: appointment.customer_name,
      serviceName: service ? localized(language, service.name_ar, service.name_en) : null,
      date,
      time,
      address: localized(language, settings?.address_ar ?? null, settings?.address_en ?? null),
      receptionPhone: settings?.reception_phone ?? clinic.phone,
    });

    // STOP is honoured on both channels: the customer was told no further messages would come.
    if (conversation.opted_out_at !== null) {
      throw new HttpError(409, "customer_opted_out", "The customer asked not to receive messages");
    }

    let message: StoredMessage;
    let usedTemplate = false;
    if (conversation.channel === "web") {
      message = await storeOutbound(db, {
        organizationId,
        conversationId: conversation.id,
        sender: "staff",
        staffUserId: user.id,
        body: text,
        status: "sent",
      });
    } else {
      const sender = await loadSender(db, organizationId);
      if (!sender || conversation.customer_wa_id === null) {
        throw new HttpError(409, "whatsapp_not_connected", "WhatsApp is not connected for this clinic");
      }
      let content: OutboundContent;
      if (withinServiceWindow(conversation.last_inbound_at, now())) {
        content = { kind: "text", body: text };
      } else if (sender.integration.confirmation_template_name) {
        // The approved template must have exactly three body variables, in this order:
        // {{1}} customer name, {{2}} date, {{3}} time (docs/WHATSAPP-SETUP.md).
        usedTemplate = true;
        content = {
          kind: "template",
          name: sender.integration.confirmation_template_name,
          language: sender.integration.confirmation_template_language,
          bodyParams: [appointment.customer_name.trim(), date, time],
        };
      } else {
        throw new HttpError(
          409,
          "template_required",
          "The customer's last message is older than 24 hours and no confirmation template is configured",
        );
      }
      const result = await sendAndRecord(db, sender, {
        conversationId: conversation.id,
        to: conversation.customer_wa_id,
        sender: "staff",
        staffUserId: user.id,
        content,
        fetchImpl: fetch,
        now: now(),
      });
      if (result.error) {
        throw new HttpError(502, "upstream_error", "WhatsApp (Meta) did not accept the message", {
          provider: "meta",
          meta_code: result.error.code,
          meta_message: result.error.metaMessage,
          error_code: graphErrorCode(result.error),
          message_id: result.message.id,
        });
      }
      message = result.message;
    }

    // Only for the time that was actually sent: if staff changed it meanwhile, the database
    // trigger has already reset the notification and this update matches nothing.
    const notifiedAt = now().toISOString();
    const { data: updated, error } = await db
      .from("appointment_requests")
      .update({ customer_notified_at: notifiedAt })
      .eq("id", appointment.id)
      .eq("organization_id", organizationId)
      .eq("status", "confirmed")
      .eq("scheduled_for", appointment.scheduled_for)
      .select("id");
    if (error) dbFailure("appointment_notified_update", error);
    const recorded = Array.isArray(updated) && updated.length > 0;
    if (!recorded) log.warn("appointment_notify.changed_during_send", { appointment_request_id: appointment.id });

    await writeAudit(db, {
      organizationId,
      actorUserId: user.id,
      actorType: "user",
      action: "appointment.customer_notified",
      entityType: "appointment_requests",
      entityId: appointment.id,
      details: {
        channel: conversation.channel,
        conversation_id: conversation.id,
        message_id: message.id,
        template: usedTemplate,
        recorded,
      },
    });
    log.info("appointment_notify.sent", {
      request_id: ctx.requestId,
      organization_id: organizationId,
      appointment_request_id: appointment.id,
      channel: conversation.channel,
    });

    return json(req, { notified_at: recorded ? notifiedAt : null, channel: conversation.channel, message });
  };
}
