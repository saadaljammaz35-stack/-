import { describe, expect, it } from "vitest";
import { translate } from "@/i18n/translate";
import {
  AUDIT_ACTIONS,
  AUDIT_CATEGORIES,
  actionsInCategory,
  auditActionLabel,
  auditActor,
  auditCategory,
  auditDetails,
  isAuditCategory,
} from "./actions";

/** Every action written by the triggers and Edge Functions (see the module comment). */
const WRITTEN_ACTIONS = [
  "organizations.create",
  "organizations.update",
  "organizations.delete",
  "organization_members.insert",
  "organization_members.update",
  "organization_members.delete",
  "clinic_settings.update",
  "clinic_services.insert",
  "clinic_services.update",
  "clinic_services.delete",
  "approved_faqs.insert",
  "approved_faqs.update",
  "approved_faqs.delete",
  "conversations.update",
  "conversations.delete",
  "appointment_requests.insert",
  "appointment_requests.update",
  "appointment_requests.delete",
  "integration_settings.insert",
  "integration_settings.update",
  "integration_settings.delete",
  "subscription_records.insert",
  "subscription_records.update",
  "subscription_records.delete",
  "assistant.tested",
  "whatsapp.credentials_saved",
  "whatsapp.webhook_verified",
  "whatsapp.disconnected",
  "member.invited",
  "appointment.customer_notified",
  "conversation.staff_reply",
  "conversation.data_deleted_by_customer",
  "conversation.deleted_by_customer",
];

describe("audit action labels", () => {
  it.each(WRITTEN_ACTIONS)("%s has a label in Arabic and English", (action) => {
    const key = auditActionLabel(action);
    expect(key).not.toBeNull();
    const ar = translate("ar", key!);
    const en = translate("en", key!);
    expect(ar).not.toBe(key);
    expect(en).not.toBe(key);
    expect(ar).not.toBe(en);
    expect(/[؀-ۿ]/.test(ar)).toBe(true);
  });

  it("gives every label a distinct text", () => {
    const keys = Object.values(AUDIT_ACTIONS).map((info) => info.label);
    const texts = keys.map((key) => translate("en", key));
    expect(new Set(texts).size).toBe(texts.length);
  });

  it("returns null for unknown actions so they are shown raw", () => {
    expect(auditActionLabel("retention.purge")).toBeNull();
    expect(auditActionLabel("toString")).toBeNull();
    expect(auditActionLabel("")).toBeNull();
  });
});

describe("audit categories", () => {
  it("puts every known action in exactly one category", () => {
    const all = AUDIT_CATEGORIES.flatMap((category) => actionsInCategory(category));
    expect(all.sort()).toEqual(Object.keys(AUDIT_ACTIONS).sort());
  });

  it("groups related actions", () => {
    expect(auditCategory("member.invited")).toBe("team");
    expect(auditCategory("organization_members.update")).toBe("team");
    expect(auditCategory("whatsapp.webhook_verified")).toBe("whatsapp");
    expect(auditCategory("integration_settings.update")).toBe("whatsapp");
    expect(auditCategory("appointment.customer_notified")).toBe("appointments");
    expect(auditCategory("clinic_settings.update")).toBe("clinic");
    expect(auditCategory("unknown.thing")).toBeNull();
    expect(actionsInCategory("billing")).toEqual([
      "subscription_records.insert",
      "subscription_records.update",
      "subscription_records.delete",
    ]);
  });

  it("validates category values from the URL", () => {
    expect(isAuditCategory("team")).toBe(true);
    expect(isAuditCategory("all")).toBe(false);
    expect(isAuditCategory(null)).toBe(false);
  });
});

describe("auditActor", () => {
  const names = new Map([["u-1", "Rana"]]);

  it("names current members", () => {
    expect(auditActor({ actor_type: "user", actor_user_id: "u-1" }, names)).toEqual({
      kind: "member",
      name: "Rana",
    });
  });

  it("marks people who are no longer on the team", () => {
    expect(auditActor({ actor_type: "user", actor_user_id: "u-gone" }, names)).toEqual({
      kind: "former",
    });
  });

  it("shows the system for automated entries", () => {
    for (const actor_type of ["system", "webhook", "assistant"]) {
      expect(auditActor({ actor_type, actor_user_id: null }, names)).toEqual({ kind: "system" });
    }
    expect(auditActor({ actor_type: "user", actor_user_id: null }, names)).toEqual({
      kind: "system",
    });
  });
});

describe("auditDetails", () => {
  it("lists changed columns", () => {
    expect(auditDetails("clinic_settings.update", { changed: ["maps_url", "working_hours"] })).toEqual(
      [{ kind: "changed", columns: ["maps_url", "working_hours"] }],
    );
  });

  it("shows an appointment status change", () => {
    expect(
      auditDetails("appointment_requests.update", {
        changed: ["confirmed_at", "confirmed_by", "status"],
        status_from: "new",
        status_to: "confirmed",
        source: "web_chat",
      }),
    ).toEqual([
      { kind: "changed", columns: ["confirmed_at", "confirmed_by", "status"] },
      { kind: "status", from: "new", to: "confirmed" },
    ]);
  });

  it("does not claim a status change when the status stayed the same", () => {
    expect(
      auditDetails("appointment_requests.update", {
        changed: ["assigned_to"],
        status_from: "new",
        status_to: "new",
      }),
    ).toEqual([{ kind: "changed", columns: ["assigned_to"] }]);
    expect(
      auditDetails("conversations.update", {
        changed: ["assigned_to"],
        channel: "web",
        status_to: "open",
        ai_paused: false,
      }),
    ).toEqual([
      { kind: "changed", columns: ["assigned_to"] },
      { kind: "channel", value: "web" },
    ]);
  });

  it("shows a role change with the member", () => {
    expect(
      auditDetails("organization_members.update", {
        changed: ["role"],
        user_id: "u-2",
        role_from: "receptionist",
        role_to: "admin",
      }),
    ).toEqual([
      { kind: "changed", columns: ["role"] },
      { kind: "member", userId: "u-2" },
      { kind: "role", from: "receptionist", to: "admin" },
    ]);
  });

  it("shows the role of an added or removed member", () => {
    expect(
      auditDetails("organization_members.insert", { user_id: "u-3", role_to: "receptionist" }),
    ).toEqual([
      { kind: "member", userId: "u-3" },
      { kind: "role", from: null, to: "receptionist" },
    ]);
    expect(
      auditDetails("organization_members.delete", { user_id: "u-3", role_from: "admin" }),
    ).toEqual([
      { kind: "member", userId: "u-3" },
      { kind: "role", from: null, to: "admin" },
    ]);
  });

  it("describes an invitation", () => {
    expect(auditDetails("member.invited", { role: "admin", new_account: true })).toEqual([
      { kind: "invitedRole", role: "admin", newAccount: true },
    ]);
  });

  it("shows when the assistant was paused", () => {
    expect(
      auditDetails("conversations.update", {
        changed: ["ai_paused", "status"],
        channel: "whatsapp",
        status_to: "awaiting_human",
        ai_paused: true,
      }),
    ).toEqual([
      { kind: "changed", columns: ["ai_paused", "status"] },
      { kind: "status", from: null, to: "awaiting_human" },
      { kind: "aiPaused", value: true },
      { kind: "channel", value: "whatsapp" },
    ]);
  });

  it("reads server-written details", () => {
    expect(auditDetails("assistant.tested", { outcome: "answered" })).toEqual([
      { kind: "outcome", value: "answered" },
    ]);
    expect(
      auditDetails("conversation.staff_reply", {
        message_id: "m",
        channel: "whatsapp",
        status: "sent",
        error_code: null,
        template: true,
      }),
    ).toEqual([
      { kind: "status", from: null, to: "sent" },
      { kind: "channel", value: "whatsapp" },
      { kind: "template" },
    ]);
    expect(
      auditDetails("conversation.data_deleted_by_customer", {
        channel: "whatsapp",
        messages_deleted: 12,
      }),
    ).toEqual([
      { kind: "channel", value: "whatsapp" },
      { kind: "messagesDeleted", count: 12 },
    ]);
    expect(
      auditDetails("subscription_records.insert", { plan: "starter", status_to: "trialing" }),
    ).toEqual([
      { kind: "status", from: null, to: "trialing" },
      { kind: "plan", value: "starter" },
    ]);
  });

  it("copes with empty or odd details", () => {
    expect(auditDetails("organizations.create", {})).toEqual([]);
    expect(auditDetails("organizations.create", null)).toEqual([]);
    expect(auditDetails("organizations.update", { changed: "name" })).toEqual([]);
    expect(auditDetails("x", [1, 2])).toEqual([]);
  });
});
