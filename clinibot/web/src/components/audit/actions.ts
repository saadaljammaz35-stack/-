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

// ───────────────────────────── actor ─────────────────────────────

export type AuditActor =
  | { kind: "member"; name: string }
  /** A user who is no longer on the team (or whose account was deleted). */
  | { kind: "former" }
  /** system, webhook and assistant entries, and user entries without a user. */
  | { kind: "system" };

export function auditActor(
  entry: { actor_type: string; actor_user_id: string | null },
  names: ReadonlyMap<string, string>,
): AuditActor {
  if (entry.actor_type !== "user" || !entry.actor_user_id) return { kind: "system" };
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
    result.push({ kind: "status", from: statusFrom === statusTo ? null : statusFrom, to: statusTo });
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
