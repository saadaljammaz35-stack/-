import { z } from "zod";
import { profileCreateSchema, profileUpdateSchema } from "@/lib/ai/identity/model-config";

// Request schemas shared by route handlers and the OpenAPI document, so the
// documentation cannot drift from what the server actually validates.

export const uuid = z.string().uuid();

export const registerSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    password: z.string().min(10).max(200),
    displayName: z.string().trim().min(1).max(120),
    locale: z.enum(["ar", "en"]).default("ar"),
  })
  .strict();

export const loginSchema = z.object({ email: z.string().trim().email().max(254), password: z.string().min(1).max(200) }).strict();

export const meUpdateSchema = z
  .object({ displayName: z.string().trim().min(1).max(120).optional(), locale: z.enum(["ar", "en"]).optional(), theme: z.enum(["system", "light", "dark"]).optional() })
  .strict();

export const modelRoleSchema = z.enum(["default", "coding", "reasoning", "arabic", "personal_assistant"]);

export const chatSchema = z
  .object({
    message: z.string().trim().min(1).max(32_000).optional(),
    conversationId: uuid.optional(),
    modelProfileId: uuid.optional(),
    modelVersionId: uuid.optional(),
    role: modelRoleSchema.optional(),
    regenerateMessageId: uuid.optional(),
  })
  .strict()
  .refine((b) => b.message || b.regenerateMessageId, { message: "message or regenerateMessageId is required" });

/**
 * A new model starts on the server's platform provider, or — when the server
 * has none (e.g. serverless hosting) — on a provider the owner registered,
 * with the model name that provider serves.
 */
export const createModelSchema = profileCreateSchema
  .extend({
    providerId: uuid.optional(),
    providerModel: z.string().trim().min(1).max(200).optional(),
  })
  .strict()
  .refine((b) => (b.providerId === undefined) === (b.providerModel === undefined), {
    message: "providerId and providerModel go together",
    path: ["providerModel"],
  });
export const updateModelSchema = profileUpdateSchema;

export const createVersionSchema = z
  .object({
    modelProfileId: uuid,
    providerId: uuid,
    baseModel: z.string().min(1).max(200),
    providerModel: z.string().min(1).max(200),
    baseModelRevision: z.string().max(100).nullish(),
    bump: z.enum(["major", "minor", "patch"]).default("minor"),
    notes: z.string().max(4000).optional(),
  })
  .strict();

export const deploySchema = z.object({ versionId: uuid }).strict();

export const roleAssignSchema = z
  .object({
    role: modelRoleSchema,
    modelProfileId: uuid,
    modelVersionId: uuid.nullish(),
    temperature: z.number().min(0).max(2).nullish(),
    maxOutputTokens: z.number().int().min(16).max(32768).nullish(),
    responseLength: z.enum(["short", "balanced", "detailed"]).nullish(),
  })
  .strict();

export const feedbackSchema = z.object({ rating: z.union([z.literal(1), z.literal(-1)]).nullable(), feedback: z.string().max(2000).optional() }).strict();

export const knowledgeTextSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    text: z.string().trim().min(1).max(500_000),
    category: z.string().trim().max(80).nullish(),
    tags: z.array(z.string().max(40)).max(20).optional(),
  })
  .strict();

export const knowledgeSearchSchema = z
  .object({
    query: z.string().trim().min(1).max(1000),
    topK: z.number().int().min(1).max(20).default(6),
    mode: z.enum(["hybrid", "semantic", "keyword"]).default("hybrid"),
    tags: z.array(z.string().max(40)).max(10).optional(),
  })
  .strict();

export const knowledgeUpdateSchema = z
  .object({ title: z.string().trim().min(1).max(255).optional(), category: z.string().trim().max(80).nullish(), tags: z.array(z.string().max(40)).max(20).optional() })
  .strict();

export const memoryCreateSchema = z
  .object({
    kind: z.enum(["preference", "fact", "project"]),
    content: z.string().trim().min(1).max(2000),
    modelProfileId: uuid.nullish(),
    /** 'approved' records that the user approved a model suggestion. */
    source: z.enum(["explicit", "approved"]).default("explicit"),
  })
  .strict();
export const memoryUpdateSchema = z.object({ content: z.string().trim().min(1).max(2000) }).strict();

export const chatMessageSchema = z.object({ role: z.enum(["system", "user", "assistant"]), content: z.string().min(1).max(20_000) }).strict();
export const datasetRecordSchema = z.object({ messages: z.array(chatMessageSchema).min(2).max(64) }).strict();

export const datasetCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().max(2000).default(""),
    datasetType: z.enum(["sft_chat", "sft_instruction"]).default("sft_chat"),
  })
  .strict();

export const datasetItemsSchema = z.object({ items: z.array(datasetRecordSchema).min(1).max(1000) }).strict();

export const datasetRightsSchema = z
  .object({ statement: z.string().trim().min(10).max(2000), confirm: z.literal(true) })
  .strict();

export const datasetFromMessageSchema = z
  .object({ datasetId: uuid, assistantMessageId: uuid, consent: z.literal(true) })
  .strict();

export const trainingJobSchema = z
  .object({
    modelProfileId: uuid,
    datasetId: uuid,
    baseModel: z.string().min(1).max(200).optional(),
    baseModelRevision: z.string().max(100).optional(),
    targetProviderId: uuid.optional(),
    method: z.enum(["lora", "qlora"]).default("qlora"),
    hyperparameters: z
      .object({
        epochs: z.number().min(0.1).max(20).default(3),
        learningRate: z.number().min(1e-6).max(1e-2).default(2e-4),
        batchSize: z.number().int().min(1).max(64).default(4),
        gradientAccumulationSteps: z.number().int().min(1).max(128).default(4),
        maxSeqLength: z.number().int().min(128).max(32768).default(2048),
        loraR: z.number().int().min(1).max(256).default(16),
        loraAlpha: z.number().int().min(1).max(512).default(32),
        loraDropout: z.number().min(0).max(0.5).default(0.05),
        warmupRatio: z.number().min(0).max(0.5).default(0.03),
        maxSteps: z.number().int().min(1).max(1_000_000).optional(),
        seed: z.number().int().min(0).max(2 ** 31 - 1).default(42),
      })
      .strict()
      .default({
        epochs: 3, learningRate: 2e-4, batchSize: 4, gradientAccumulationSteps: 4, maxSeqLength: 2048,
        loraR: 16, loraAlpha: 32, loraDropout: 0.05, warmupRatio: 0.03, seed: 42,
      }),
    /** Explicitly allow a CPU run. Only accepted for models under 1B parameters (pipeline smoke tests). */
    allowCpu: z.boolean().default(false),
  })
  .strict();

export const evaluationSchema = z
  .object({
    modelVersionId: uuid,
    evaluationType: z
      .enum(["full", "arabic_quality", "saudi_dialect", "english_quality", "coding", "reasoning", "instruction_following", "retrieval", "hallucination", "tool_calling", "latency"])
      .default("full"),
  })
  .strict();

export const providerCreateSchema = z
  .object({
    providerName: z.string().trim().min(1).max(80),
    providerType: z.enum(["openai_compatible", "huggingface", "vllm"]),
    endpoint: z.string().url().max(500),
    apiKey: z.string().min(1).max(4096).optional(),
    pricing: z.object({ inputPer1k: z.number().min(0), outputPer1k: z.number().min(0) }).strict().optional(),
  })
  .strict();

export const apiKeyCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    scopes: z.array(z.enum(["chat", "models:read", "knowledge:read", "knowledge:write", "usage:read"])).min(1).max(5),
    expiresInDays: z.number().int().min(1).max(365).optional(),
  })
  .strict();
