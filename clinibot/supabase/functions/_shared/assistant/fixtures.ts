// Shared test data: two clinics' rows in one set of in-memory tables, so a
// query without its organization filter visibly leaks the other clinic.
// Not imported by any entrypoint.

import { FakeDb, type FakeResult, memoryResponder, type Row } from "./fakes.ts";
import type { ClinicFaq, ClinicService, ClinicSettings, KnowledgeBase } from "./knowledge.ts";

export const ORG = "11111111-1111-4111-8111-111111111111";
export const OTHER_ORG = "22222222-2222-4222-8222-222222222222";
export const CONV = "33333333-3333-4333-8333-333333333333";
export const OTHER_CONV = "39999999-3333-4333-8333-333333333333";
export const SERVICE_CLEANING = "44444444-4444-4444-8444-444444444444";
export const SERVICE_WHITENING = "55555555-5555-4555-8555-555555555555";
export const SERVICE_INACTIVE = "5aaaaaaa-5555-4555-8555-555555555555";
export const SERVICE_OTHER_CLINIC = "66666666-6666-4666-8666-666666666666";

export function settings(overrides: Partial<ClinicSettings> = {}): ClinicSettings {
  return {
    display_name_ar: "عيادة الابتسامة",
    display_name_en: "Smile Clinic",
    address_ar: "الرياض، حي العليا",
    address_en: "Olaya, Riyadh",
    maps_url: "https://maps.example.com/smile",
    reception_phone: "+966112345678",
    timezone: "Asia/Riyadh",
    working_hours: {
      sat: [["09:00", "21:00"]],
      sun: [["09:00", "13:00"], ["16:00", "22:00"]],
      mon: [["09:00", "21:00"]],
      tue: [["09:00", "21:00"]],
      wed: [["09:00", "21:00"]],
      thu: [["09:00", "18:00"]],
      fri: [],
    },
    working_hours_note_ar: null,
    working_hours_note_en: null,
    assistant_enabled: true,
    public_chat_enabled: true,
    assistant_name: "Noura",
    assistant_tone: "friendly",
    welcome_message_ar: null,
    welcome_message_en: null,
    extra_instructions: "Mention free parking. A follow-up visit within 14 days costs 75 SAR.",
    emergency_number: "997",
    privacy_notice_ar: null,
    privacy_notice_en: null,
    message_retention_days: 180,
    ...overrides,
  };
}

export const SERVICES: ClinicService[] = [
  {
    id: SERVICE_CLEANING,
    name_ar: "تنظيف الأسنان",
    name_en: "Teeth cleaning",
    description_ar: "تنظيف وتلميع",
    description_en: "Scaling and polishing",
    price_type: "fixed",
    price_sar: 250,
    duration_minutes: 45,
  },
  {
    id: SERVICE_WHITENING,
    name_ar: "تبييض الأسنان",
    name_en: "Teeth whitening",
    description_ar: null,
    description_en: null,
    price_type: "starting_from",
    price_sar: 1500,
    duration_minutes: 60,
  },
];

export const FAQS: ClinicFaq[] = [
  {
    id: "77777777-7777-4777-8777-777777777777",
    question_ar: "هل يوجد مواقف؟",
    answer_ar: "نعم، المواقف مجانية.",
    question_en: "Is there parking?",
    answer_en: "Yes, parking is free.",
  },
  {
    id: "88888888-8888-4888-8888-888888888888",
    question_ar: "كم سعر الكشف؟",
    answer_ar: "الكشف ١٥٠ ريال.",
    question_en: null,
    answer_en: null,
  },
];

export const ORG_NAME = "عيادة الابتسامة لطب الأسنان";

export function knowledgeBase(overrides: Partial<ClinicSettings> = {}): KnowledgeBase {
  return {
    organizationId: ORG,
    name: ORG_NAME,
    defaultLanguage: "ar",
    settings: settings(overrides),
    services: SERVICES,
    faqs: FAQS,
  };
}

export interface SeedOptions {
  settings?: Partial<ClinicSettings>;
  conversation?: Row;
  messages?: Row[];
}

/** Both clinics' rows. ORG's conversation CONV is a web chat unless overridden. */
export function seedTables(options: SeedOptions = {}): Record<string, Row[]> {
  return {
    organizations: [
      { id: ORG, name: ORG_NAME, slug: "smile", default_language: "ar" },
      { id: OTHER_ORG, name: "Other Clinic", slug: "other", default_language: "en" },
    ],
    clinic_settings: [
      { organization_id: ORG, ...settings(options.settings) },
      {
        organization_id: OTHER_ORG,
        ...settings({ display_name_ar: "عيادة أخرى", display_name_en: "Other", extra_instructions: "Say 999 SAR" }),
      },
    ],
    clinic_services: [
      { ...SERVICES[0], organization_id: ORG, is_active: true, sort_order: 1 },
      { ...SERVICES[1], organization_id: ORG, is_active: true, sort_order: 2 },
      {
        id: SERVICE_INACTIVE,
        organization_id: ORG,
        name_ar: "خدمة متوقفة",
        name_en: "Retired service",
        description_ar: null,
        description_en: null,
        price_type: "fixed",
        price_sar: 777,
        duration_minutes: null,
        is_active: false,
        sort_order: 0,
      },
      {
        id: SERVICE_OTHER_CLINIC,
        organization_id: OTHER_ORG,
        name_ar: "خدمة عيادة أخرى",
        name_en: "Other clinic service",
        description_ar: null,
        description_en: null,
        price_type: "fixed",
        price_sar: 999,
        duration_minutes: 30,
        is_active: true,
        sort_order: 0,
      },
    ],
    approved_faqs: [
      { ...FAQS[0], organization_id: ORG, is_active: true, sort_order: 1 },
      { ...FAQS[1], organization_id: ORG, is_active: true, sort_order: 2 },
      {
        id: "99999999-9999-4999-8999-999999999999",
        organization_id: ORG,
        question_ar: "سؤال قديم",
        answer_ar: "إجابة قديمة بسعر ٦٦٦ ريال",
        question_en: null,
        answer_en: null,
        is_active: false,
        sort_order: 0,
      },
      {
        id: "9aaaaaaa-9999-4999-8999-999999999999",
        organization_id: OTHER_ORG,
        question_ar: null,
        answer_ar: null,
        question_en: "Other clinic question",
        answer_en: "Other clinic answer",
        is_active: true,
        sort_order: 0,
      },
    ],
    conversations: [
      {
        id: CONV,
        organization_id: ORG,
        channel: "web",
        status: "open",
        ai_paused: false,
        language: "ar",
        opted_out_at: null,
        privacy_notice_sent_at: "2026-10-12T08:00:00.000Z",
        customer_name: null,
        handoff_reason: null,
        web_session_hash: "a".repeat(64),
        ...options.conversation,
      },
      {
        id: OTHER_CONV,
        organization_id: OTHER_ORG,
        channel: "web",
        status: "open",
        ai_paused: false,
        language: "en",
        opted_out_at: null,
        privacy_notice_sent_at: null,
        customer_name: "Other customer",
        handoff_reason: null,
        web_session_hash: "b".repeat(64),
      },
    ],
    messages: [
      {
        id: crypto.randomUUID(),
        organization_id: OTHER_ORG,
        conversation_id: OTHER_CONV,
        direction: "inbound",
        sender: "customer",
        body: "other clinic message",
        status: "received",
        created_at: "2026-10-12T08:59:00.000Z",
      },
      ...(options.messages ?? []),
    ],
    appointment_requests: [],
  };
}

export interface RpcState {
  entitlements: { is_active: boolean; ai_replies_remaining: number } | null;
  rateLimited: Set<string>;
  rateLimiterDown: boolean;
}

export interface Clinic {
  db: FakeDb;
  tables: Record<string, Row[]>;
  rpc: RpcState;
}

/** In-memory clinic data plus the service-role RPCs the functions call. */
export function clinicDb(options: SeedOptions = {}, users: Record<string, string> = {}): Clinic {
  const tables = seedTables(options);
  const rpc: RpcState = {
    entitlements: { is_active: true, ai_replies_remaining: 100 },
    rateLimited: new Set(),
    rateLimiterDown: false,
  };
  const respondRpc = (name: string, params: Record<string, unknown>): FakeResult | undefined => {
    switch (name) {
      case "org_entitlements":
        return { data: params.p_org === ORG ? rpc.entitlements : null };
      case "consume_rate_limit": {
        if (rpc.rateLimiterDown) return { error: { message: "down", code: "XX000" } };
        const key = String(params.p_key);
        return { data: ![...rpc.rateLimited].some((prefix) => key.startsWith(prefix)) };
      }
      case "record_ai_usage":
      case "write_audit":
        return { data: null };
    }
    return { error: { message: `unknown rpc ${name}` } };
  };
  const db = new FakeDb(
    memoryResponder(tables, {
      appointment_requests: { status: "new" },
      conversations: { status: "open", ai_paused: false, opted_out_at: null },
    }),
    respondRpc,
    users,
  );
  return { db, tables, rpc };
}
