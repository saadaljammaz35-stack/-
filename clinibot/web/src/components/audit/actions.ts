import type { MessageKey } from "@/i18n";
import type { Json } from "@/lib/database.types";

/**
 * Every audit action the system writes (database triggers in
 * supabase/migrations, write_audit calls in supabase/functions), with its
 * label and filter category. Unknown actions are shown as written.
 */
export const AUDIT_CATEGORIES = [
  "clinic",
  "team",
  "knowledge",
  "assistant",
  "conversations",
  "appointments",
  "whatsapp",
  "billing",
] as const;

export type AuditCategory = (typeof AUDIT_CATEGORIES)[number];

interface ActionInfo {
  label: MessageKey;
  category: AuditCategory;
}

export const AUDIT_ACTIONS = {
  "organizations.create": { label: "audit.action_organizations_create", category: "clinic" },
  "organizations.update": { label: "audit.action_organizations_update", category: "clinic" },
  "organizations.delete": { label: "audit.action_organizations_delete", category: "clinic" },
  "clinic_settings.update": { label: "audit.action_clinic_settings_update", category: "clinic" },
  "organization_members.insert": {
    label: "audit.action_organization_members_insert",
    category: "team",
  },
  "organization_members.update": {
    label: "audit.action_organization_members_update",
    category: "team",
  },
  "organization_members.delete": {
    label: "audit.action_organization_members_delete",
    category: "team",
  },
  "member.invited": { label: "audit.action_member_invited", category: "team" },
  "clinic_services.insert": { label: "audit.action_clinic_services_insert", category: "knowledge" },
  "clinic_services.update": { label: "audit.action_clinic_services_update", category: "knowledge" },
  "clinic_services.delete": { label: "audit.action_clinic_services_delete", category: "knowledge" },
  "approved_faqs.insert": { label: "audit.action_approved_faqs_insert", category: "knowledge" },
  "approved_faqs.update": { label: "audit.action_approved_faqs_update", category: "knowledge" },
  "approved_faqs.delete": { label: "audit.action_approved_faqs_delete", category: "knowledge" },
  "assistant.tested": { label: "audit.action_assistant_tested", category: "assistant" },
  "conversations.update": {
    label: "audit.action_conversations_update",
    category: "conversations",
  },
  "conversations.delete": {
    label: "audit.action_conversations_delete",
    category: "conversations",
  },
  "conversation.staff_reply": {
    label: "audit.action_conversation_staff_reply",
    category: "conversations",
  },
  "conversation.data_deleted_by_customer": {
    label: "audit.action_conversation_data_deleted_by_customer",
    category: "conversations",
  },
  "conversation.deleted_by_customer": {
    label: "audit.action_conversation_deleted_by_customer",
    category: "conversations",
  },
  "appointment_requests.insert": {
    label: "audit.action_appointment_requests_insert",
    category: "appointments",
  },
  "appointment_requests.update": {
    label: "audit.action_appointment_requests_update",
    category: "appointments",
  },
  "appointment_requests.delete": {
    label: "audit.action_appointment_requests_delete",
    category: "appointments",
  },
  "appointment.customer_notified": {
    label: "audit.action_appointment_customer_notified",
    category: "appointments",
  },
  "integration_settings.insert": {
    label: "audit.action_integration_settings_insert",
    category: "whatsapp",
  },
  "integration_settings.update": {
    label: "audit.action_integration_settings_update",
    category: "whatsapp",
  },
  "integration_settings.delete": {
    label: "audit.action_integration_settings_delete",
    category: "whatsapp",
  },
  "whatsapp.credentials_saved": {
    label: "audit.action_whatsapp_credentials_saved",
    category: "whatsapp",
  },
  "whatsapp.webhook_verified": {
    label: "audit.action_whatsapp_webhook_verified",
    category: "whatsapp",
  },
  "whatsapp.verify_token_rotated": {
    label: "audit.action_whatsapp_verify_token_rotated",
    category: "whatsapp",
  },
  "whatsapp.disconnected": { label: "audit.action_whatsapp_disconnected", category: "whatsapp" },
  "subscription_records.insert": {
    label: "audit.action_subscription_records_insert",
    category: "billing",
  },
  "subscription_records.update": {
    label: "audit.action_subscription_records_update",
    category: "billing",
  },
  "subscription_records.delete": {
    label: "audit.action_subscription_records_delete",
    category: "billing",
  },
} as const satisfies Record<string, ActionInfo>;

export type KnownAuditAction = keyof typeof AUDIT_ACTIONS;

function info(action: string): ActionInfo | undefined {
  return Object.prototype.hasOwnProperty.call(AUDIT_ACTIONS, action)
    ? AUDIT_ACTIONS[action as KnownAuditAction]
    : undefined;
}

/** The message key for a known action, or null (show the raw action). */
export function auditActionLabel(action: string): MessageKey | null {
  return info(action)?.label ?? null;
}

export function auditCategory(action: string): AuditCategory | null {
  return info(action)?.category ?? null;
}

/** The actions in one filter category, for an `in` filter on the query. */
export function actionsInCategory(category: AuditCategory): KnownAuditAction[] {
  return (Object.keys(AUDIT_ACTIONS) as KnownAuditAction[]).filter(
    (action) => AUDIT_ACTIONS[action].category === category,
  );
}

export function isAuditCategory(value: unknown): value is AuditCategory {
  return typeof value === "string" && (AUDIT_CATEGORIES as readonly string[]).includes(value);
}

// ──────────────────────────── changed columns ────────────────────────────

/**
 * Readable names for the columns an update can change (details.changed),
 * across every audited table. A column missing here is shown as written.
 */
export const AUDIT_COLUMN_LABELS = {
  // organizations
  name: "audit.col_name",
  city: "audit.col_city",
  phone: "audit.col_phone",
  default_language: "audit.col_default_language",
  // clinic_settings
  display_name_ar: "audit.col_display_name_ar",
  display_name_en: "audit.col_display_name_en",
  address_ar: "audit.col_address_ar",
  address_en: "audit.col_address_en",
  maps_url: "audit.col_maps_url",
  reception_phone: "audit.col_reception_phone",
  timezone: "audit.col_timezone",
  working_hours: "audit.col_working_hours",
  working_hours_note_ar: "audit.col_working_hours_note_ar",
  working_hours_note_en: "audit.col_working_hours_note_en",
  assistant_enabled: "audit.col_assistant_enabled",
  public_chat_enabled: "audit.col_public_chat_enabled",
  assistant_name: "audit.col_assistant_name",
  assistant_tone: "audit.col_assistant_tone",
  welcome_message_ar: "audit.col_welcome_message_ar",
  welcome_message_en: "audit.col_welcome_message_en",
  extra_instructions: "audit.col_extra_instructions",
  emergency_number: "audit.col_emergency_number",
  privacy_notice_ar: "audit.col_privacy_notice_ar",
  privacy_notice_en: "audit.col_privacy_notice_en",
  message_retention_days: "audit.col_message_retention_days",
  appointment_retention_days: "audit.col_appointment_retention_days",
  ai_last_test_at: "audit.col_ai_last_test_at",
  ai_last_test_ok: "audit.col_ai_last_test_ok",
  // organization_members
  role: "audit.col_role",
  // clinic_services, approved_faqs
  name_ar: "audit.col_name_ar",
  name_en: "audit.col_name_en",
  description_ar: "audit.col_description_ar",
  description_en: "audit.col_description_en",
  price_type: "audit.col_price_type",
  price_sar: "audit.col_price_sar",
  duration_minutes: "audit.col_duration_minutes",
  question_ar: "audit.col_question_ar",
  answer_ar: "audit.col_answer_ar",
  question_en: "audit.col_question_en",
  answer_en: "audit.col_answer_en",
  is_active: "audit.col_is_active",
  sort_order: "audit.col_sort_order",
  // conversations, appointment_requests
  status: "audit.col_status",
  ai_paused: "audit.col_ai_paused",
  assigned_to: "audit.col_assigned_to",
  customer_name: "audit.col_customer_name",
  customer_phone: "audit.col_customer_phone",
  customer_notes: "audit.col_customer_notes",
  language: "audit.col_language",
  handoff_reason: "audit.col_handoff_reason",
  consent_at: "audit.col_consent_at",
  privacy_notice_sent_at: "audit.col_privacy_notice_sent_at",
  opted_out_at: "audit.col_opted_out_at",
  conversation_id: "audit.col_conversation_id",
  service_id: "audit.col_service_id",
  preferred_date: "audit.col_preferred_date",
  preferred_time_window: "audit.col_preferred_time_window",
  scheduled_for: "audit.col_scheduled_for",
  confirmed_at: "audit.col_confirmed_at",
  confirmed_by: "audit.col_confirmed_by",
  cancelled_at: "audit.col_cancelled_at",
  completed_at: "audit.col_completed_at",
  customer_notified_at: "audit.col_customer_notified_at",
  // integration_settings
  phone_number_id: "audit.col_phone_number_id",
  waba_id: "audit.col_waba_id",
  display_phone_number: "audit.col_display_phone_number",
  verified_name: "audit.col_verified_name",
  webhook_key: "audit.col_webhook_key",
  credentials_verified_at: "audit.col_credentials_verified_at",
  webhook_verified_at: "audit.col_webhook_verified_at",
  last_error: "audit.col_last_error",
  confirmation_template_name: "audit.col_confirmation_template_name",
  confirmation_template_language: "audit.col_confirmation_template_language",
  // subscription_records
  plan: "audit.col_plan",
  trial_ends_at: "audit.col_trial_ends_at",
  current_period_start: "audit.col_current_period_start",
  current_period_end: "audit.col_current_period_end",
  provider: "audit.col_provider",
  provider_customer_ref: "audit.col_provider_customer_ref",
  provider_subscription_ref: "audit.col_provider_subscription_ref",
  notes: "audit.col_notes",
} as const satisfies Record<string, MessageKey>;

/** The message key for a changed column, or null (show the column name as written). */
export function auditColumnLabel(column: string): MessageKey | null {
  return Object.prototype.hasOwnProperty.call(AUDIT_COLUMN_LABELS, column)
    ? AUDIT_COLUMN_LABELS[column as keyof typeof AUDIT_COLUMN_LABELS]
    : null;
}

// ───────────────────────────── actor ─────────────────────────────

export type AuditActor =
  | { kind: "member"; name: string }
  /** A user who is no longer on the team (or whose account was deleted). */
  | { kind: "former" }
  /** system, webhook and assistant entries, and user entries without a user. */
  | { kind: "system" }
  /** A user, but the team list is not available (still loading or failed): never guess "former". */
  | { kind: "unknown" };

/**
 * Who did it. `names` maps user ids to the current team's names, or is null
 * while the team list is unavailable.
 */
export function auditActor(
  entry: { actor_type: string; actor_user_id: string | null },
  names: ReadonlyMap<string, string> | null,
): AuditActor {
  if (entry.actor_type !== "user" || !entry.actor_user_id) return { kind: "system" };
  if (names === null) return { kind: "unknown" };
  const name = names.get(entry.actor_user_id);
  return name ? { kind: "member", name } : { kind: "former" };
}

// ───────────────────────────── details ─────────────────────────────

/**
 * Structured facts from audit_logs.details. The log never holds personal data
 * (no names, phones or message text), only ids, column names and states.
 */
export type AuditDetail =
  | { kind: "changed"; columns: string[] }
  | { kind: "status"; from: string | null; to: string }
  | { kind: "role"; from: string | null; to: string }
  | { kind: "invitedRole"; role: string; newAccount: boolean | null }
  | { kind: "member"; userId: string }
  | { kind: "aiPaused"; value: boolean }
  | { kind: "plan"; value: string }
  | { kind: "channel"; value: string }
  | { kind: "outcome"; value: string }
  | { kind: "template" }
  | { kind: "messagesDeleted"; count: number };

function asObject(value: Json | undefined): Record<string, Json | undefined> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : {};
}

function text(value: Json | undefined): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

/** Turns a details object into the facts worth showing, in a stable order. */
export function auditDetails(action: string, details: Json): AuditDetail[] {
  const data = asObject(details);
  const result: AuditDetail[] = [];

  const changed = Array.isArray(data.changed)
    ? data.changed.filter((item): item is string => typeof item === "string")
    : null;
  if (changed && changed.length > 0) result.push({ kind: "changed", columns: changed });
  // On an update, a state is worth showing only when that column actually changed.
  const changedHere = (column: string) =>
    !action.endsWith(".update") || changed === null || changed.includes(column);

  if (action === "member.invited") {
    const role = text(data.role);
    if (role) {
      const newAccount = typeof data.new_account === "boolean" ? data.new_account : null;
      result.push({ kind: "invitedRole", role, newAccount });
    }
  }

  const userId = text(data.user_id);
  if (userId) result.push({ kind: "member", userId });

  // An insert carries only role_to, a delete only role_from: show the role either way.
  const roleTo = text(data.role_to);
  const roleFrom = text(data.role_from);
  if (roleTo && changedHere("role")) {
    result.push({ kind: "role", from: roleFrom === roleTo ? null : roleFrom, to: roleTo });
  } else if (!roleTo && roleFrom) {
    result.push({ kind: "role", from: null, to: roleFrom });
  }

  const statusTo = text(data.status_to);
  const statusFrom = text(data.status_from);
  const plainStatus = text(data.status); // conversation.staff_reply, whatsapp.webhook_verified
  if (statusTo && changedHere("status")) {
    result.push({
      kind: "status",
      from: statusFrom === statusTo ? null : statusFrom,
      to: statusTo,
    });
  } else if (!statusTo && statusFrom) {
    result.push({ kind: "status", from: null, to: statusFrom });
  } else if (!statusTo && plainStatus) {
    result.push({ kind: "status", from: null, to: plainStatus });
  }

  if (typeof data.ai_paused === "boolean" && action === "conversations.update") {
    if (changed?.includes("ai_paused")) result.push({ kind: "aiPaused", value: data.ai_paused });
  }

  const plan = text(data.plan);
  if (plan) result.push({ kind: "plan", value: plan });

  const channel = text(data.channel);
  if (channel) result.push({ kind: "channel", value: channel });

  const outcome = text(data.outcome);
  if (outcome) result.push({ kind: "outcome", value: outcome });

  if (data.template === true) result.push({ kind: "template" });

  if (typeof data.messages_deleted === "number") {
    result.push({ kind: "messagesDeleted", count: data.messages_deleted });
  }

  return result;
}
