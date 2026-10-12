// The assistant's two tools. The model's input is untrusted: it is validated
// again here (strict schemas constrain shape, not meaning), and every rule
// that matters (a real phone number, a date that makes sense, a service of
// this clinic, a per-conversation cap) is enforced on the server.
//
// Live mode writes to the database scoped to one clinic and conversation.
// Test mode (the staff console) validates the same way but writes nothing.

import { type Anthropic, z } from "../deps.ts";
import type { Db } from "../db.ts";
import { log } from "../log.ts";
import { normalizePhone } from "../phone.ts";
import type { ToolExecution, ToolExecutor } from "./claude.ts";
import type { KnowledgeBase } from "./knowledge.ts";
import { riyadhDate } from "./prompt.ts";

export const HANDOFF_REASONS = [
  "medical_question",
  "complaint",
  "unknown_answer",
  "customer_request",
  "booking_help",
  "other",
] as const;
export type HandoffReason = typeof HANDOFF_REASONS[number];

export const TIME_WINDOWS = ["morning", "afternoon", "evening", "any"] as const;

const nullableString = (description: string) => ({ type: ["string", "null"], description });

export const TOOL_DEFINITIONS: Anthropic.Beta.BetaTool[] = [
  {
    name: "create_appointment_request",
    description:
      "Records an appointment REQUEST for the clinic's reception to follow up. It does not book or confirm a time. " +
      "Call it only once you have the customer's name and, on web chat, their mobile number.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        customer_name: { type: "string", description: "The customer's name as they gave it." },
        customer_phone: nullableString("Mobile number as the customer wrote it (required on web chat), or null."),
        service_id: nullableString("A service id from CLINIC KNOWLEDGE, or null if unknown."),
        preferred_date: nullableString("Preferred date as YYYY-MM-DD, or null."),
        preferred_time_window: { type: "string", enum: [...TIME_WINDOWS], description: "Preferred part of the day." },
        notes: nullableString("Short note for reception (no ID, insurance or medical history), or null."),
      },
      required: ["customer_name", "customer_phone", "service_id", "preferred_date", "preferred_time_window", "notes"],
      additionalProperties: false,
    },
  },
  {
    name: "request_human_handoff",
    description:
      "Hands the conversation to the clinic's staff and pauses the assistant. Use for medical questions, complaints, " +
      "requests for a person, booking help, or questions CLINIC KNOWLEDGE does not answer.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        reason: { type: "string", enum: [...HANDOFF_REASONS], description: "Why staff are needed." },
        summary: { type: "string", description: "Short factual summary for staff, at most 300 characters." },
      },
      required: ["reason", "summary"],
      additionalProperties: false,
    },
  },
];

const appointmentSchema = z.strictObject({
  customer_name: z.string().trim().min(2).max(120),
  customer_phone: z.string().max(40).nullable(),
  service_id: z.string().trim().max(64).nullable(),
  preferred_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD").nullable(),
  preferred_time_window: z.enum(TIME_WINDOWS),
  notes: z.string().trim().max(2000).nullable(),
});

const handoffSchema = z.strictObject({
  reason: z.enum(HANDOFF_REASONS),
  summary: z.string().trim().min(1).max(2000),
});

export type AppointmentInput = z.infer<typeof appointmentSchema>;
export type HandoffInput = { reason: HandoffReason; summary: string };

export interface AppointmentReport {
  customer_name: string;
  service_id: string | null;
  preferred_date: string | null;
  preferred_time_window: string;
  saved: boolean;
  request_id: string | null;
}

/** What the tools did during one turn, for the caller's status and the test console. */
export interface ToolReport {
  handoff: HandoffInput | null;
  appointment: AppointmentReport | null;
}

export interface ToolSet {
  execute: ToolExecutor;
  report: ToolReport;
}

const SUMMARY_LIMIT = 300;
const NOTES_LIMIT = 1000;
const MAX_DAYS_AHEAD = 180;
export const MAX_REQUESTS_PER_DAY = 2;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY_MS = 86_400_000;

function rejected(error: string): ToolExecution {
  return { result: { ok: false, error }, isError: true };
}

function invalidInput(error: z.ZodError): ToolExecution {
  // Zod messages name fields and constraints, never the submitted values.
  const issues = error.issues.slice(0, 5).map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`);
  return rejected(`Invalid input. ${issues.join("; ")}`);
}

function dayNumber(isoDate: string): number | null {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (y === undefined || m === undefined || d === undefined) return null;
  const time = Date.UTC(y, m - 1, d);
  const check = new Date(time);
  // Rejects dates that do not exist, such as 2026-02-30.
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return null;
  return time / DAY_MS;
}

/** Null when the date is acceptable: a real date, not before today in Riyadh, at most 180 days ahead. */
export function dateProblem(preferredDate: string, now: Date): string | null {
  const day = dayNumber(preferredDate);
  const today = dayNumber(riyadhDate(now));
  if (day === null || today === null) return "preferred_date is not a real calendar date.";
  if (day < today) return `preferred_date is in the past. Today in Riyadh is ${riyadhDate(now)}.`;
  if (day > today + MAX_DAYS_AHEAD) return `preferred_date is more than ${MAX_DAYS_AHEAD} days ahead.`;
  return null;
}

interface AppointmentRules {
  channel: "web" | "whatsapp";
  senderPhone: string | null;
  now: Date;
  isActiveService(id: string): Promise<boolean>;
}

type Validated = { ok: true; value: AppointmentInput & { phone: string } } | { ok: false; execution: ToolExecution };

async function validateAppointment(raw: unknown, rules: AppointmentRules): Promise<Validated> {
  const parsed = appointmentSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, execution: invalidInput(parsed.error) };
  const input = parsed.data;

  // A number the customer typed wins; on WhatsApp the sender's own number is the fallback.
  const typed = input.customer_phone ? normalizePhone(input.customer_phone) : null;
  const phone = typed ?? (rules.channel === "whatsapp" ? rules.senderPhone : null);
  if (!phone) {
    return {
      ok: false,
      execution: rejected("A valid mobile number is required (for example 05XXXXXXXX). Ask the customer for it."),
    };
  }

  if (input.preferred_date) {
    const problem = dateProblem(input.preferred_date, rules.now);
    if (problem) return { ok: false, execution: rejected(problem) };
  }

  if (input.service_id) {
    const known = UUID.test(input.service_id) && await rules.isActiveService(input.service_id);
    if (!known) {
      return {
        ok: false,
        execution: rejected("Unknown service_id. Use an id listed in CLINIC KNOWLEDGE, or null if unsure."),
      };
    }
  }
  return { ok: true, value: { ...input, phone } };
}

function parseHandoff(raw: unknown): { ok: true; value: HandoffInput } | { ok: false; execution: ToolExecution } {
  const parsed = handoffSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, execution: invalidInput(parsed.error) };
  return { ok: true, value: { reason: parsed.data.reason, summary: parsed.data.summary.slice(0, SUMMARY_LIMIT) } };
}

/** Stored on the conversation for staff: the reason code, then the model's summary. */
export function handoffReasonText(handoff: HandoffInput): string {
  return `${handoff.reason}: ${handoff.summary}`.slice(0, 500);
}

// ───────────────────────────── live mode ─────────────────────────────

class ToolDbError extends Error {
  constructor(readonly context: string, readonly code: string | undefined) {
    super(`Database error in ${context}`);
    this.name = "ToolDbError";
  }
}

export interface LiveToolContext {
  db: Db;
  organizationId: string;
  conversationId: string;
  channel: "web" | "whatsapp";
  /** The WhatsApp sender in E.164, the only phone the server knows without asking. */
  customerPhone: string | null;
  now: () => Date;
}

export function createLiveTools(ctx: LiveToolContext): ToolSet {
  const report: ToolReport = { handoff: null, appointment: null };

  async function isActiveService(id: string): Promise<boolean> {
    const { data, error } = await ctx.db
      .from("clinic_services")
      .select("id")
      .eq("id", id)
      .eq("organization_id", ctx.organizationId)
      .eq("is_active", true)
      .maybeSingle();
    if (error) throw new ToolDbError("service_lookup", error.code);
    return data !== null;
  }

  async function createAppointment(raw: unknown): Promise<ToolExecution> {
    const now = ctx.now();
    const validated = await validateAppointment(raw, {
      channel: ctx.channel,
      senderPhone: ctx.customerPhone,
      now,
      isActiveService,
    });
    if (!validated.ok) return validated.execution;
    const input = validated.value;

    const since = new Date(now.getTime() - DAY_MS).toISOString();
    const { count, error: countError } = await ctx.db
      .from("appointment_requests")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", ctx.organizationId)
      .eq("conversation_id", ctx.conversationId)
      .gte("created_at", since);
    if (countError) throw new ToolDbError("appointment_count", countError.code);
    if ((count ?? 0) >= MAX_REQUESTS_PER_DAY) {
      return rejected(
        `This conversation already has ${MAX_REQUESTS_PER_DAY} appointment requests in the last 24 hours. ` +
          "Do not create another; tell the customer reception will contact them about their existing request.",
      );
    }

    const { data, error } = await ctx.db
      .from("appointment_requests")
      .insert({
        organization_id: ctx.organizationId,
        conversation_id: ctx.conversationId,
        service_id: input.service_id,
        customer_name: input.customer_name,
        customer_phone: input.phone,
        preferred_date: input.preferred_date,
        preferred_time_window: input.preferred_time_window,
        customer_notes: input.notes ? input.notes.slice(0, NOTES_LIMIT) : null,
        source: ctx.channel === "whatsapp" ? "whatsapp" : "web_chat",
      })
      .select("id, status")
      .single();
    if (error || !data) throw new ToolDbError("appointment_insert", error?.code);
    const row = data as { id: string; status: string };

    report.appointment = {
      customer_name: input.customer_name,
      service_id: input.service_id,
      preferred_date: input.preferred_date,
      preferred_time_window: input.preferred_time_window,
      saved: true,
      request_id: row.id,
    };
    log.info("assistant.appointment_requested", {
      organization_id: ctx.organizationId,
      conversation_id: ctx.conversationId,
      request_id: row.id,
    });
    return { result: { ok: true, request_id: row.id, status: "new" }, isError: false };
  }

  async function handoff(raw: unknown): Promise<ToolExecution> {
    const parsed = parseHandoff(raw);
    if (!parsed.ok) return parsed.execution;
    const { error } = await ctx.db
      .from("conversations")
      .update({ status: "awaiting_human", ai_paused: true, handoff_reason: handoffReasonText(parsed.value) })
      .eq("id", ctx.conversationId)
      .eq("organization_id", ctx.organizationId);
    if (error) throw new ToolDbError("handoff_update", error.code);
    report.handoff = parsed.value;
    log.info("assistant.handoff", {
      organization_id: ctx.organizationId,
      conversation_id: ctx.conversationId,
      reason: parsed.value.reason,
    });
    return { result: { ok: true, status: "awaiting_human" }, isError: false };
  }

  const execute: ToolExecutor = async (name, input) => {
    try {
      if (name === "create_appointment_request") return await createAppointment(input);
      if (name === "request_human_handoff") return await handoff(input);
      return rejected(`Unknown tool: ${name.slice(0, 64)}`);
    } catch (error) {
      // Database trouble: the model is told plainly that nothing was saved, so it cannot claim otherwise.
      log.error("assistant.tool_failed", {
        tool: name.slice(0, 64),
        context: error instanceof ToolDbError ? error.context : "unexpected",
        code: error instanceof ToolDbError ? error.code : null,
        error_name: error instanceof Error ? error.name : null,
      });
      return rejected("A system error occurred and nothing was saved. Offer the reception phone instead.");
    }
  };

  return { execute, report };
}

// ───────────────────────────── test mode ─────────────────────────────

export const TEST_REQUEST_ID = "test-mode-not-saved";

/** Same validation as live mode against the loaded knowledge; nothing is written. */
export function createTestTools(kb: KnowledgeBase, now: () => Date): ToolSet {
  const report: ToolReport = { handoff: null, appointment: null };
  const activeIds = new Set(kb.services.map((service) => service.id.toLowerCase()));

  const execute: ToolExecutor = async (name, raw) => {
    if (name === "create_appointment_request") {
      const validated = await validateAppointment(raw, {
        channel: "web",
        senderPhone: null,
        now: now(),
        isActiveService: (id) => Promise.resolve(activeIds.has(id.toLowerCase())),
      });
      if (!validated.ok) return validated.execution;
      const input = validated.value;
      report.appointment = {
        customer_name: input.customer_name,
        service_id: input.service_id,
        preferred_date: input.preferred_date,
        preferred_time_window: input.preferred_time_window,
        saved: false,
        request_id: null,
      };
      return { result: { ok: true, request_id: TEST_REQUEST_ID, status: "new" }, isError: false };
    }
    if (name === "request_human_handoff") {
      const parsed = parseHandoff(raw);
      if (!parsed.ok) return parsed.execution;
      report.handoff = parsed.value;
      return { result: { ok: true, status: "awaiting_human" }, isError: false };
    }
    return rejected(`Unknown tool: ${name.slice(0, 64)}`);
  };

  return { execute, report };
}
