import type { MessageKey } from "@/i18n";
import type { Enums, Tables } from "@/lib/database.types";
import type { BadgeTone } from "@/components/ui";
import { toLatinDigits } from "@/lib/validation";

export type AppointmentStatus = Enums<"appointment_status">;
export type TimeWindow = "morning" | "afternoon" | "evening" | "any";
export type AppointmentSource = "web_chat" | "whatsapp" | "dashboard";

export const APPOINTMENT_STATUSES: readonly AppointmentStatus[] = [
  "new",
  "contacted",
  "confirmed",
  "completed",
  "cancelled",
];

/**
 * Exactly the database state machine (private.appointment_transition):
 *   new       → contacted | confirmed | cancelled
 *   contacted → confirmed | cancelled
 *   confirmed → completed | cancelled
 *   cancelled, completed: final
 */
export const APPOINTMENT_TRANSITIONS: Readonly<
  Record<AppointmentStatus, readonly AppointmentStatus[]>
> = {
  new: ["contacted", "confirmed", "cancelled"],
  contacted: ["confirmed", "cancelled"],
  confirmed: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export function allowedNextStatuses(status: AppointmentStatus): readonly AppointmentStatus[] {
  return APPOINTMENT_TRANSITIONS[status] ?? [];
}

export function canTransition(from: AppointmentStatus, to: AppointmentStatus): boolean {
  return allowedNextStatuses(from).includes(to);
}

export function isFinalStatus(status: AppointmentStatus): boolean {
  return allowedNextStatuses(status).length === 0;
}

export function isAppointmentStatus(value: unknown): value is AppointmentStatus {
  return APPOINTMENT_STATUSES.includes(value as AppointmentStatus);
}

export const STATUS_LABELS: Record<AppointmentStatus, MessageKey> = {
  new: "appointments.statusNew",
  contacted: "appointments.statusContacted",
  confirmed: "appointments.statusConfirmed",
  completed: "appointments.statusCompleted",
  cancelled: "appointments.statusCancelled",
};

export const STATUS_TONES: Record<AppointmentStatus, BadgeTone> = {
  new: "info",
  contacted: "warning",
  confirmed: "success",
  completed: "brand",
  cancelled: "neutral",
};

export const TIME_WINDOWS: readonly TimeWindow[] = ["any", "morning", "afternoon", "evening"];

export const TIME_WINDOW_LABELS: Record<TimeWindow, MessageKey> = {
  morning: "appointments.windowMorning",
  afternoon: "appointments.windowAfternoon",
  evening: "appointments.windowEvening",
  any: "appointments.windowAny",
};

export function isTimeWindow(value: unknown): value is TimeWindow {
  return TIME_WINDOWS.includes(value as TimeWindow);
}

export const SOURCE_LABELS: Record<AppointmentSource, MessageKey> = {
  web_chat: "appointments.sourceWebChat",
  whatsapp: "appointments.sourceWhatsapp",
  dashboard: "appointments.sourceDashboard",
};

export function sourceLabel(source: string): MessageKey {
  return SOURCE_LABELS[source as AppointmentSource] ?? "appointments.sourceDashboard";
}

export const LIST_TABS = [
  "new",
  "contacted",
  "confirmed",
  "completed",
  "cancelled",
  "all",
] as const;
export type ListTab = (typeof LIST_TABS)[number];

export function isListTab(value: unknown): value is ListTab {
  return LIST_TABS.includes(value as ListTab);
}

// ───────────────────────────── rows ─────────────────────────────

export interface ServiceName {
  name_ar: string | null;
  name_en: string | null;
}

export type AppointmentListRow = Pick<
  Tables<"appointment_requests">,
  | "id"
  | "customer_name"
  | "customer_phone"
  | "preferred_date"
  | "preferred_time_window"
  | "source"
  | "status"
  | "assigned_to"
  | "scheduled_for"
  | "customer_notified_at"
  | "created_at"
> & { service: ServiceName | null };

export const LIST_COLUMNS =
  "id, customer_name, customer_phone, preferred_date, preferred_time_window, source, status, assigned_to, scheduled_for, customer_notified_at, created_at, service:clinic_services(name_ar, name_en)";

export type AppointmentDetailRow = Tables<"appointment_requests"> & {
  service: ServiceName | null;
  conversation: { id: string; channel: Enums<"conversation_channel"> } | null;
};

export const DETAIL_COLUMNS =
  "*, service:clinic_services(name_ar, name_en), conversation:conversations(id, channel)";

/** A service name in the UI language, falling back to the other one. */
export function serviceName(service: ServiceName | null | undefined, lang: "ar" | "en"): string {
  if (!service) return "";
  return (
    (lang === "ar" ? (service.name_ar ?? service.name_en) : (service.name_en ?? service.name_ar)) ??
    ""
  );
}

// ───────────────────────────── phone ─────────────────────────────

/**
 * Normalises a phone number exactly like the server
 * (supabase/functions/_shared/phone.ts): Arabic-Indic digits → ASCII,
 * spaces/dashes/brackets dropped, "05XXXXXXXX" / "5XXXXXXXX" → "+9665XXXXXXXX",
 * "00…" → "+…". Returns null unless the result is a valid E.164 number
 * (and a Saudi number has exactly 9 digits after 966).
 */
export function normalizeCustomerPhone(input: string): string | null {
  let value = toLatinDigits(input)
    .trim()
    .replace(/[\s\-().]/g, "");
  if (value.startsWith("+")) value = value.slice(1);
  else if (value.startsWith("00")) value = value.slice(2);
  else if (/^05\d{8}$/.test(value)) value = `966${value.slice(1)}`;
  else if (/^5\d{8}$/.test(value)) value = `966${value}`;
  if (!/^[1-9]\d{7,14}$/.test(value)) return null;
  if (value.startsWith("966") && value.length !== 12) return null;
  return `+${value}`;
}

/**
 * Search box value → what to filter on. Digits (any script) search the phone
 * column ("055…" also finds "+96655…"); anything else searches the name.
 */
export function parseAppointmentSearch(
  input: string,
): { kind: "name"; value: string } | { kind: "phone"; value: string } | null {
  const trimmed = input.trim().slice(0, 80);
  if (!trimmed) return null;
  const compact = toLatinDigits(trimmed).replace(/[\s\-().+]/g, "");
  if (/^\d{3,}$/.test(compact)) {
    return { kind: "phone", value: compact.replace(/^0+/, "") || compact };
  }
  return { kind: "name", value: trimmed };
}

export const NAME_MIN = 2;
export const NAME_MAX = 120;
export const NOTES_MAX = 1000;
export const NOTE_MAX = 2000;
