import { z } from "zod";
import * as S from "./schemas";

// OpenAPI 3.1 built from the same zod schemas the route handlers validate
// with, so the document cannot drift from server behaviour.

type Auth = "public" | "any" | "session";
interface Op {
  method: "get" | "post" | "patch" | "put" | "delete";
  path: string;
  summary: string;
  tag: string;
  auth: Auth;
  scope?: string;
  body?: z.ZodType;
  multipart?: string[];
  sse?: boolean;
}

const ops: Op[] = [
  { method: "post", path: "/api/auth/register", summary: "Create an account and workspace", tag: "Auth", auth: "public", body: S.registerSchema },
  { method: "post", path: "/api/auth/login", summary: "Sign in (sets an HttpOnly session cookie)", tag: "Auth", auth: "public", body: S.loginSchema },
  { method: "post", path: "/api/auth/logout", summary: "Revoke the current session", tag: "Auth", auth: "session" },
  { method: "get", path: "/api/auth/me", summary: "Current user and workspaces", tag: "Auth", auth: "any" },
  { method: "post", path: "/api/ai/chat", summary: "Chat (waits for the full answer)", tag: "Chat", auth: "any", scope: "chat", body: S.chatSchema },
  { method: "post", path: "/api/ai/chat/stream", summary: "Chat over Server-Sent Events: meta, delta*, tool*, done | error", tag: "Chat", auth: "any", scope: "chat", body: S.chatSchema, sse: true },
  { method: "get", path: "/api/ai/conversations", summary: "List conversations", tag: "Chat", auth: "any", scope: "chat" },
  { method: "get", path: "/api/ai/conversations/{id}", summary: "Conversation with messages and sources", tag: "Chat", auth: "any", scope: "chat" },
  { method: "delete", path: "/api/ai/conversations/{id}", summary: "Delete a conversation", tag: "Chat", auth: "any", scope: "chat" },
  { method: "post", path: "/api/ai/messages/{id}/feedback", summary: "Rate an answer", tag: "Chat", auth: "any", scope: "chat", body: S.feedbackSchema },
  { method: "get", path: "/api/ai/models", summary: "Model Hub: personal models, providers, base-model catalog", tag: "Models", auth: "any", scope: "models:read" },
  { method: "get", path: "/api/ai/models/personal", summary: "Personal models with versions", tag: "Models", auth: "any", scope: "models:read" },
  { method: "post", path: "/api/ai/models/personal", summary: "Create a personal model (version 1.0.0 on the default base model)", tag: "Models", auth: "session", body: S.createModelSchema },
  { method: "get", path: "/api/ai/models/personal/versions", summary: "Versions of a model (?modelProfileId=) with latest evaluation", tag: "Models", auth: "any", scope: "models:read" },
  { method: "post", path: "/api/ai/models/personal/versions", summary: "New version on another base model / provider", tag: "Models", auth: "session", body: S.createVersionSchema },
  { method: "get", path: "/api/ai/models/{id}", summary: "Model identity and versions", tag: "Models", auth: "any", scope: "models:read" },
  { method: "patch", path: "/api/ai/models/{id}", summary: "Update identity and behaviour settings", tag: "Models", auth: "session", body: S.updateModelSchema },
  { method: "post", path: "/api/ai/models/{id}/deploy", summary: "Deploy a version (409 DEPLOY_GATE unless a full evaluation passed)", tag: "Models", auth: "session", body: S.deploySchema },
  { method: "delete", path: "/api/ai/models/{id}/deploy", summary: "Take the deployed version offline", tag: "Models", auth: "session" },
  { method: "get", path: "/api/ai/base-models", summary: "Verified base-model catalog", tag: "Models", auth: "any", scope: "models:read" },
  { method: "get", path: "/api/ai/roles", summary: "Model roles (default, coding, reasoning, arabic, personal_assistant)", tag: "Models", auth: "any", scope: "models:read" },
  { method: "put", path: "/api/ai/roles", summary: "Bind a role to a model / pinned version with overrides", tag: "Models", auth: "session", body: S.roleAssignSchema },
  { method: "get", path: "/api/ai/providers", summary: "Model providers and connection status", tag: "Providers", auth: "any", scope: "models:read" },
  { method: "post", path: "/api/ai/providers", summary: "Register a personal https provider (key sealed, never returned)", tag: "Providers", auth: "session", body: S.providerCreateSchema },
  { method: "post", path: "/api/ai/providers/{id}/health", summary: "Live health check", tag: "Providers", auth: "any", scope: "models:read" },
  { method: "get", path: "/api/ai/providers/{id}/models", summary: "Models the provider serves", tag: "Providers", auth: "any", scope: "models:read" },
  { method: "get", path: "/api/ai/knowledge", summary: "List documents (?q, tag, category)", tag: "Knowledge", auth: "any", scope: "knowledge:read" },
  { method: "post", path: "/api/ai/knowledge/upload", summary: "Upload PDF, DOCX, TXT, MD, JSON or JSONL (type detected from content)", tag: "Knowledge", auth: "any", scope: "knowledge:write", multipart: ["file", "title", "category", "tags", "replaceDocumentId"] },
  { method: "post", path: "/api/ai/knowledge/text", summary: "Add typed or pasted text", tag: "Knowledge", auth: "any", scope: "knowledge:write", body: S.knowledgeTextSchema },
  { method: "post", path: "/api/ai/knowledge/search", summary: "Hybrid / semantic / keyword search with sources", tag: "Knowledge", auth: "any", scope: "knowledge:read", body: S.knowledgeSearchSchema },
  { method: "post", path: "/api/ai/knowledge/reindex", summary: "Re-process every document", tag: "Knowledge", auth: "any", scope: "knowledge:write" },
  { method: "get", path: "/api/ai/knowledge/{id}", summary: "Document with its chunks", tag: "Knowledge", auth: "any", scope: "knowledge:read" },
  { method: "patch", path: "/api/ai/knowledge/{id}", summary: "Rename, re-categorise, re-tag", tag: "Knowledge", auth: "any", scope: "knowledge:write", body: S.knowledgeUpdateSchema },
  { method: "delete", path: "/api/ai/knowledge/{id}", summary: "Delete a document and its chunks", tag: "Knowledge", auth: "any", scope: "knowledge:write" },
  { method: "post", path: "/api/ai/knowledge/{id}/reprocess", summary: "Re-run extraction and embeddings", tag: "Knowledge", auth: "any", scope: "knowledge:write" },
  { method: "get", path: "/api/ai/memory", summary: "List long-term memories", tag: "Memory", auth: "session" },
  { method: "post", path: "/api/ai/memory", summary: "Save a memory (secrets and identifiers refused)", tag: "Memory", auth: "session", body: S.memoryCreateSchema },
  { method: "patch", path: "/api/ai/memory/{id}", summary: "Edit a memory", tag: "Memory", auth: "session", body: S.memoryUpdateSchema },
  { method: "delete", path: "/api/ai/memory/{id}", summary: "Delete a memory", tag: "Memory", auth: "session" },
  { method: "get", path: "/api/ai/datasets", summary: "List datasets", tag: "Training", auth: "session" },
  { method: "post", path: "/api/ai/datasets", summary: "Create a dataset", tag: "Training", auth: "session", body: S.datasetCreateSchema },
  { method: "get", path: "/api/ai/datasets/{id}", summary: "Dataset with its last validation report", tag: "Training", auth: "session" },
  { method: "get", path: "/api/ai/datasets/{id}/items", summary: "Review items (?status, split)", tag: "Training", auth: "session" },
  { method: "post", path: "/api/ai/datasets/{id}/items", summary: "Add chat records", tag: "Training", auth: "session", body: S.datasetItemsSchema },
  { method: "post", path: "/api/ai/datasets/{id}/upload", summary: "Upload JSONL/JSON records", tag: "Training", auth: "session", multipart: ["file"] },
  { method: "post", path: "/api/ai/datasets/{id}/validate", summary: "Validate, de-duplicate, flag PII, split", tag: "Training", auth: "session" },
  { method: "post", path: "/api/ai/datasets/{id}/rights", summary: "Confirm the right to train on this data", tag: "Training", auth: "session", body: S.datasetRightsSchema },
  { method: "post", path: "/api/ai/datasets/from-message", summary: "Add a chat answer to a dataset (consent required)", tag: "Training", auth: "session", body: S.datasetFromMessageSchema },
  { method: "get", path: "/api/ai/training/jobs", summary: "List training jobs", tag: "Training", auth: "session" },
  { method: "post", path: "/api/ai/training/jobs", summary: "Queue a LoRA/QLoRA job", tag: "Training", auth: "session", body: S.trainingJobSchema },
  { method: "get", path: "/api/ai/training/jobs/{id}", summary: "Job, metric series and logs", tag: "Training", auth: "session" },
  { method: "post", path: "/api/ai/training/jobs/{id}/cancel", summary: "Cancel a queued or running job", tag: "Training", auth: "session" },
  { method: "get", path: "/api/ai/training/infrastructure", summary: "Training workers and GPUs (from heartbeats)", tag: "Training", auth: "session" },
  { method: "get", path: "/api/ai/evaluations", summary: "Evaluation runs (?modelVersionId)", tag: "Evaluation", auth: "session" },
  { method: "post", path: "/api/ai/evaluations", summary: "Start an evaluation run (202)", tag: "Evaluation", auth: "session", body: S.evaluationSchema },
  { method: "get", path: "/api/ai/evaluations/{id}", summary: "Run with every case", tag: "Evaluation", auth: "session" },
  { method: "get", path: "/api/ai/evaluations/compare", summary: "Compare two versions (?baseline&candidate)", tag: "Evaluation", auth: "session" },
  { method: "get", path: "/api/ai/evaluations/suite", summary: "The fixed suite and thresholds", tag: "Evaluation", auth: "session" },
  { method: "get", path: "/api/ai/usage", summary: "Usage analytics (?days)", tag: "Usage", auth: "any", scope: "usage:read" },
  { method: "get", path: "/api/ai/api-keys", summary: "List API keys", tag: "API keys", auth: "session" },
  { method: "post", path: "/api/ai/api-keys", summary: "Create an API key (token returned once)", tag: "API keys", auth: "session", body: S.apiKeyCreateSchema },
  { method: "delete", path: "/api/ai/api-keys/{id}", summary: "Revoke an API key", tag: "API keys", auth: "session" },
  { method: "get", path: "/api/ai/audit", summary: "Your audit trail", tag: "Audit", auth: "session" },
  { method: "get", path: "/api/health", summary: "Liveness and database readiness", tag: "System", auth: "public" },
  { method: "get", path: "/api/ai/apps", summary: "List App Studio projects", tag: "App Studio", auth: "session" },
  { method: "post", path: "/api/ai/apps", summary: "Create an app project", tag: "App Studio", auth: "session", body: S.appCreateSchema },
  { method: "get", path: "/api/ai/apps/{id}", summary: "Project with current files, versions, messages and a preview link", tag: "App Studio", auth: "session" },
  { method: "patch", path: "/api/ai/apps/{id}", summary: "Rename or re-describe a project", tag: "App Studio", auth: "session", body: S.appUpdateSchema },
  { method: "delete", path: "/api/ai/apps/{id}", summary: "Delete a project and all its versions", tag: "App Studio", auth: "session" },
  { method: "post", path: "/api/ai/apps/{id}/generate", summary: "Build or change the app with your model (SSE: meta, delta, file, warning, done | error)", tag: "App Studio", auth: "session", body: S.appGenerateSchema, sse: true },
  { method: "get", path: "/api/ai/apps/{id}/versions/{versionId}", summary: "Files and preview link of one version", tag: "App Studio", auth: "session" },
  { method: "post", path: "/api/ai/apps/{id}/restore", summary: "Make an older version current (as a new version)", tag: "App Studio", auth: "session", body: S.appRestoreSchema },
  { method: "post", path: "/api/ai/apps/{id}/publish", summary: "Publish a version at a public link", tag: "App Studio", auth: "session", body: S.appPublishSchema },
  { method: "delete", path: "/api/ai/apps/{id}/publish", summary: "Take the public link down", tag: "App Studio", auth: "session" },
];

const errorSchema = {
  type: "object",
  properties: {
    error: {
      type: "object",
      properties: { code: { type: "string" }, message: { type: "string" }, details: {}, requestId: { type: "string" } },
      required: ["code", "message", "requestId"],
    },
  },
};

export function buildOpenApi(): Record<string, unknown> {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const op of ops) {
    const params = [...op.path.matchAll(/\{(\w+)\}/g)].map((m) => ({ name: m[1], in: "path", required: true, schema: { type: "string", format: "uuid" } }));
    const security = op.auth === "public" ? [] : op.auth === "session" ? [{ session: [] }] : [{ session: [] }, { apiKey: [] }];
    paths[op.path] ??= {};
    paths[op.path]![op.method] = {
      summary: op.summary,
      tags: [op.tag],
      security,
      ...(params.length ? { parameters: params } : {}),
      ...(op.scope ? { "x-api-key-scope": op.scope } : {}),
      ...(op.body
        ? { requestBody: { required: true, content: { "application/json": { schema: z.toJSONSchema(op.body, { io: "input", unrepresentable: "any" }) } } } }
        : op.multipart
          ? { requestBody: { required: true, content: { "multipart/form-data": { schema: { type: "object", properties: Object.fromEntries(op.multipart.map((f) => [f, { type: "string", ...(f === "file" ? { format: "binary" } : {}) }])) } } } } }
          : {}),
      responses: {
        "200": { description: "OK", content: op.sse ? { "text/event-stream": { schema: { type: "string" } } } : { "application/json": { schema: { type: "object" } } } },
        default: { description: "Error", content: { "application/json": { schema: errorSchema } } },
      },
    };
  }
  return {
    openapi: "3.1.0",
    info: {
      title: "OMNIX Personal AI API",
      version: "1.0.0",
      description:
        "Private model API. Authenticate with the session cookie (browser) or `Authorization: Bearer omx_…` (API key with scopes). " +
        "Every response carries X-Request-Id. Errors are `{ error: { code, message, requestId } }`. API keys reach only deployed model versions.",
    },
    servers: [{ url: "/" }],
    components: {
      securitySchemes: {
        session: { type: "apiKey", in: "cookie", name: "omnix_session" },
        apiKey: { type: "http", scheme: "bearer", description: "omx_<prefix>_<secret>; scopes: chat, models:read, knowledge:read, knowledge:write, usage:read" },
      },
    },
    paths,
  };
}

export const OPENAPI_OPERATIONS = ops;
