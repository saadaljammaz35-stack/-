import { z } from "zod";

// =============================================================================
// Layer A — Model identity. The single place that defines what a personal
// model is configured by. Nothing else in the codebase hard-codes a model
// name, personality or default; they all read a profile validated here.
// =============================================================================

export const MODEL_FAMILY = "OMNIX Personal Intelligence";
export const FIRST_VERSION = "1.0.0";
export const SUPPORTED_LANGUAGES = ["ar", "en"] as const;

export const TOOL_NAMES = ["knowledge_search", "current_time", "fetch_url"] as const;
export type ToolName = (typeof TOOL_NAMES)[number];

export const DEFAULT_PERSONALITY = {
  ar: "ذكي، مباشر، دقيق، احترافي، يفهم السياق، متعاون، وقادر تقنيًا. يجيب بلغة عربية فصيحة سليمة، ويفهم اللهجة السعودية جيدًا.",
  en: "Intelligent, direct, accurate, professional, context-aware, helpful and technically capable.",
};

/** Secondary settings stored in ai_model_profiles.configuration (jsonb). */
export const extendedConfigSchema = z
  .object({
    tools: z
      .object({
        allowed: z.array(z.enum(TOOL_NAMES)).max(TOOL_NAMES.length).default(["knowledge_search", "current_time"]),
      })
      .strict()
      .default({ allowed: ["knowledge_search", "current_time"] }),
    retrieval: z
      .object({
        topK: z.number().int().min(1).max(20).default(6),
        // Minimum fused relevance for a chunk to be shown to the model.
        minScore: z.number().min(0).max(1).default(0.3),
        tags: z.array(z.string().max(40)).max(10).default([]),
      })
      .strict()
      .default({ topK: 6, minScore: 0.3, tags: [] }),
    memory: z
      .object({
        topK: z.number().int().min(0).max(20).default(5),
        includeProjectContext: z.boolean().default(true),
      })
      .strict()
      .default({ topK: 5, includeProjectContext: true }),
    citeSources: z.boolean().default(true),
  })
  .strict();

export type ExtendedConfig = z.infer<typeof extendedConfigSchema>;

export const profileFieldsSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  slug: z
    .string()
    .trim()
    .max(64)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "lowercase letters, digits and single hyphens")
    .optional(),
  description: z.string().max(2000).default(""),
  defaultLanguage: z.enum(["ar", "en", "auto"]).default("ar"),
  personality: z.string().max(4000).default(""),
  systemPrompt: z.string().max(16000).default(""),
  temperature: z.number().min(0).max(2).default(0.4),
  precisionMode: z.enum(["strict", "balanced", "creative"]).default("balanced"),
  responseLength: z.enum(["short", "balanced", "detailed"]).default("balanced"),
  maxOutputTokens: z.number().int().min(16).max(32768).default(1024),
  knowledgeMode: z.enum(["off", "assist", "strict"]).default("assist"),
  memoryEnabled: z.boolean().default(true),
  maxToolCalls: z.number().int().min(0).max(10).default(3),
  configuration: extendedConfigSchema.default(extendedConfigSchema.parse({})),
}).strict();

export const profileCreateSchema = profileFieldsSchema;
export const profileUpdateSchema = profileFieldsSchema.partial().strict();
export type ProfileFields = z.infer<typeof profileFieldsSchema>;

/** A model profile as the engine sees it (camelCase view of ai_model_profiles). */
export interface ModelProfile {
  id: string;
  ownerId: string;
  workspaceId: string;
  displayName: string;
  slug: string;
  description: string;
  modelFamily: string;
  defaultLanguage: "ar" | "en" | "auto";
  personality: string;
  systemPrompt: string;
  temperature: number;
  precisionMode: "strict" | "balanced" | "creative";
  responseLength: "short" | "balanced" | "detailed";
  maxOutputTokens: number;
  knowledgeMode: "off" | "assist" | "strict";
  memoryEnabled: boolean;
  maxToolCalls: number;
  configuration: ExtendedConfig;
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
}

export function slugify(name: string): string {
  const ascii = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 56);
  // Arabic-only names produce no ASCII; fall back to a stable generic slug.
  return ascii || "personal-ai";
}

export function profileFromRow(r: Record<string, unknown>): ModelProfile {
  const cfg = extendedConfigSchema.safeParse(r.configuration ?? {});
  return {
    id: r.id as string,
    ownerId: r.owner_id as string,
    workspaceId: r.workspace_id as string,
    displayName: r.display_name as string,
    slug: r.slug as string,
    description: r.description as string,
    modelFamily: r.model_family as string,
    defaultLanguage: r.default_language as ModelProfile["defaultLanguage"],
    personality: r.personality as string,
    systemPrompt: r.system_prompt as string,
    temperature: Number(r.temperature),
    precisionMode: r.precision_mode as ModelProfile["precisionMode"],
    responseLength: r.response_length as ModelProfile["responseLength"],
    maxOutputTokens: Number(r.max_output_tokens),
    knowledgeMode: r.knowledge_mode as ModelProfile["knowledgeMode"],
    memoryEnabled: Boolean(r.memory_enabled),
    maxToolCalls: Number(r.max_tool_calls),
    configuration: cfg.success ? cfg.data : extendedConfigSchema.parse({}),
    status: r.status as ModelProfile["status"],
    createdAt: new Date(r.created_at as string).toISOString(),
    updatedAt: new Date(r.updated_at as string).toISOString(),
  };
}

export interface GenerationParams {
  temperature: number;
  topP: number;
  maxTokens: number;
  responseLength: ModelProfile["responseLength"];
}

export interface RoleOverride {
  temperature?: number | null;
  maxOutputTokens?: number | null;
  responseLength?: ModelProfile["responseLength"] | null;
}

/**
 * Creativity is the temperature. Precision narrows nucleus sampling and, in
 * strict mode, caps temperature. Response length caps the token budget.
 */
export function generationParams(p: ModelProfile, role?: RoleOverride): GenerationParams {
  const responseLength = role?.responseLength ?? p.responseLength;
  let temperature = role?.temperature ?? p.temperature;
  let maxTokens = role?.maxOutputTokens ?? p.maxOutputTokens;
  const topP = p.precisionMode === "strict" ? 0.8 : p.precisionMode === "creative" ? 0.95 : 0.9;
  if (p.precisionMode === "strict") temperature = Math.min(temperature, 0.2);
  if (responseLength === "short") maxTokens = Math.min(maxTokens, 400);
  return { temperature, topP, maxTokens, responseLength };
}
