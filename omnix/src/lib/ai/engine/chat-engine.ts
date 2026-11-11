import "server-only";
import { audit } from "@/lib/audit";
import type { AuthContext } from "@/lib/auth/session";
import { withUser } from "@/lib/db/pool";
import { AppError } from "@/lib/http/errors";
import { log } from "@/lib/log";
import { fitContext } from "../context/context-manager";
import { generationParams } from "../identity/model-config";
import { recallMemories, type Memory } from "../memory/memory";
import { findCandidate } from "../models/catalog";
import { resolveModel, type ModelRole, type ResolvedModel } from "../models/service";
import { buildContextBlock, buildSystemPrompt, notFoundAnswer, type SourceForPrompt } from "../prompt/system-prompt";
import { loadProvider, syncPlatformProviders, type ProviderRecord } from "../providers/registry";
import { ProviderError, type ChatMessage, type ModelProvider, type ToolCall, type Usage } from "../providers/types";
import { hybridSearch } from "../rag/retrieve";
import { authorizeToolCall, availableTools, executeTool } from "../tools/tools";
import { StreamSanitizer, validateOutput } from "./output-guard";

export interface SourceRef {
  id: string;
  documentId: string;
  title: string;
  filename: string;
  page: number | null;
  chunkIndex: number;
  score: number;
  snippet: string;
}

export type ChatEvent =
  | {
      type: "meta";
      conversationId: string;
      userMessageId: string;
      assistantMessageId: string;
      model: { profileId: string; displayName: string; versionId: string; version: string; baseModel: string; preview: boolean; provider: string };
      sources: SourceRef[];
      memoriesUsed: number;
    }
  | { type: "delta"; text: string }
  | { type: "tool"; name: string; status: "started" | "finished" | "denied"; detail?: string }
  | {
      type: "done";
      message: { id: string; content: string; status: "complete" | "cancelled"; cited: string[]; finishReason: string; usage: Usage; latencyMs: number; firstTokenMs: number | null };
    }
  | { type: "error"; code: string; message: string; messageId?: string };

export interface ChatTurnInput {
  auth: AuthContext & { requestId: string; ip?: string | null };
  message?: string;
  conversationId?: string;
  modelProfileId?: string;
  modelVersionId?: string;
  role?: ModelRole;
  /** Regenerate the answer to the user message that preceded this assistant message. */
  regenerateMessageId?: string;
  signal: AbortSignal;
}

const contextCache = new Map<string, { value: number; at: number }>();

async function contextLengthFor(provider: ModelProvider, rec: ProviderRecord, model: string, baseModel: string): Promise<number> {
  const key = `${rec.id}|${model}`;
  const hit = contextCache.get(key);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.value;
  let value = await provider
    .getModelInfo(model)
    .then((i) => i.contextLength)
    .catch(() => null);
  // Hosted OpenAI-compatible services that do not report it serve modern
  // long-context models; a local server with an unknown model gets the safe minimum.
  value ??= findCandidate(baseModel)?.contextLength ?? (rec.providerType === "openai_compatible" && rec.ownerId ? 32_768 : 4096);
  // Serving engines are often configured below the architectural maximum; cap to stay safe.
  value = Math.min(value, 131_072);
  contextCache.set(key, { value, at: Date.now() });
  return value;
}

function mapError(err: unknown): { code: string; message: string } {
  if (err instanceof AppError) return { code: err.code, message: err.message };
  if (err instanceof ProviderError) {
    const code =
      err.code === "timeout" ? "PROVIDER_TIMEOUT" : err.code === "context_length" ? "CONTEXT_TOO_LONG" : err.code === "unavailable" ? "PROVIDER_UNAVAILABLE" : "PROVIDER_ERROR";
    return { code, message: err.message };
  }
  return { code: "INTERNAL", message: "The model could not complete this answer" };
}

function estimateCost(rec: ProviderRecord, usage: Usage): number | null {
  const price = rec.capabilities.pricing as { inputPer1k?: number; outputPer1k?: number } | undefined;
  if (!price || typeof price.inputPer1k !== "number" || typeof price.outputPer1k !== "number") return null;
  return (usage.inputTokens / 1000) * price.inputPer1k + (usage.outputTokens / 1000) * price.outputPer1k;
}

export async function* runChatTurn(input: ChatTurnInput): AsyncGenerator<ChatEvent> {
  const ctx = input.auth;
  const started = Date.now();

  // ---- Phase 1: one short transaction — resolve, persist the question, retrieve.
  const prep = await withUser(ctx.userId, async (db) => {
    await syncPlatformProviders(db);
    let resolved: ResolvedModel;
    let conversationId = input.conversationId;
    let userText = input.message?.trim() ?? "";
    let parentMessageId: string | null = null;
    let userMessageId: string;

    if (conversationId) {
      const c = await db.query("SELECT * FROM ai_conversations WHERE id = $1 AND workspace_id = $2", [conversationId, ctx.workspaceId]);
      if (!c.rowCount) throw new AppError("NOT_FOUND", "Conversation not found");
      resolved = await resolveModel(db, ctx, {
        modelProfileId: c.rows[0].model_profile_id,
        modelVersionId: input.modelVersionId,
      });
    } else {
      resolved = await resolveModel(db, ctx, { modelProfileId: input.modelProfileId, modelVersionId: input.modelVersionId, role: input.role });
    }

    if (input.regenerateMessageId) {
      if (!conversationId) throw new AppError("BAD_REQUEST", "conversationId is required to regenerate");
      const target = await db.query(
        "SELECT id FROM ai_messages WHERE id = $1 AND conversation_id = $2 AND role = 'assistant'",
        [input.regenerateMessageId, conversationId],
      );
      if (!target.rowCount) throw new AppError("NOT_FOUND", "Message not found");
      // Compared in SQL: a JS Date would truncate microseconds and miss the row.
      const q = await db.query(
        `SELECT id, content FROM ai_messages
          WHERE conversation_id = $1 AND role = 'user'
            AND created_at <= (SELECT created_at FROM ai_messages WHERE id = $2)
          ORDER BY created_at DESC LIMIT 1`,
        [conversationId, input.regenerateMessageId],
      );
      if (!q.rowCount) throw new AppError("NOT_FOUND", "No question to regenerate");
      userText = q.rows[0].content;
      userMessageId = q.rows[0].id;
      parentMessageId = target.rows[0].id;
    } else {
      if (!userText) throw new AppError("VALIDATION_FAILED", "Message is empty");
      if (!conversationId) {
        const c = await db.query(
          `INSERT INTO ai_conversations (owner_id, workspace_id, model_profile_id, title) VALUES ($1, $2, $3, $4) RETURNING id`,
          [ctx.userId, ctx.workspaceId, resolved.profile.id, userText.replace(/\s+/g, " ").slice(0, 80)],
        );
        conversationId = c.rows[0].id as string;
      }
      const um = await db.query(
        `INSERT INTO ai_messages (conversation_id, role, content) VALUES ($1, 'user', $2) RETURNING id`,
        [conversationId, userText],
      );
      userMessageId = um.rows[0].id;
    }

    // Short-term memory: the turns before the current question. Answers that
    // were later regenerated are superseded and left out.
    const h = await db.query<{ role: ChatMessage["role"]; content: string }>(
      `SELECT role, content FROM (
         SELECT m.role, m.content, m.created_at FROM ai_messages m
          WHERE m.conversation_id = $1 AND m.role IN ('user', 'assistant')
            AND m.status IN ('complete', 'cancelled') AND m.content <> ''
            AND m.created_at < (SELECT created_at FROM ai_messages WHERE id = $2)
            AND NOT EXISTS (SELECT 1 FROM ai_messages x WHERE x.parent_message_id = m.id)
          ORDER BY m.created_at DESC LIMIT 40) t
        ORDER BY created_at ASC`,
      [conversationId, userMessageId],
    );

    const { profile } = resolved;
    let sources: SourceForPrompt[] = [];
    let hadAnySearch = false;
    if (profile.knowledgeMode !== "off") {
      hadAnySearch = true;
      const hits = await hybridSearch(db, {
        workspaceId: ctx.workspaceId,
        query: userText,
        topK: profile.configuration.retrieval.topK,
        tags: profile.configuration.retrieval.tags,
      });
      sources = hits.filter((c) => c.relevant).map((c, i) => ({ ...c, sourceId: `S${i + 1}` }));
    }
    let memories: Memory[] = [];
    if (profile.memoryEnabled && profile.configuration.memory.topK > 0) {
      memories = await recallMemories(db, ctx, {
        query: userText,
        modelProfileId: profile.id,
        topK: profile.configuration.memory.topK,
        includeProject: profile.configuration.memory.includeProjectContext,
      });
    }

    const am = await db.query(
      `INSERT INTO ai_messages (conversation_id, role, content, status, model_version_id, parent_message_id)
       VALUES ($1, 'assistant', '', 'streaming', $2, $3) RETURNING id`,
      [conversationId, resolved.version.id, parentMessageId],
    );
    const { record, provider } = await loadProvider(db, resolved.version.providerId);
    return {
      resolved,
      record,
      provider,
      conversationId: conversationId!,
      userMessageId,
      assistantMessageId: am.rows[0].id as string,
      userText,
      history: h.rows.map((r) => ({ role: r.role, content: r.content })),
      sources,
      memories,
      hadAnySearch,
    };
  });

  const { resolved, provider, record, sources, memories } = prep;
  const { profile, version } = resolved;
  const sourceRefs: SourceRef[] = sources.map((s) => ({
    id: s.sourceId,
    documentId: s.documentId,
    title: s.documentTitle,
    filename: s.filename,
    page: s.page,
    chunkIndex: s.chunkIndex,
    score: Number(s.score.toFixed(4)),
    snippet: s.content.slice(0, 280),
  }));

  yield {
    type: "meta",
    conversationId: prep.conversationId,
    userMessageId: prep.userMessageId,
    assistantMessageId: prep.assistantMessageId,
    model: {
      profileId: profile.id,
      displayName: profile.displayName,
      versionId: version.id,
      version: version.version,
      baseModel: version.baseModel,
      preview: resolved.preview,
      provider: record.providerName,
    },
    sources: sourceRefs,
    memoriesUsed: memories.length,
  };

  const allowed = new Set(sources.map((s) => s.sourceId));
  const sanitizer = new StreamSanitizer(allowed);
  let usage: Usage = { inputTokens: 0, outputTokens: 0, source: "estimate" };
  let finishReason = "stop";
  let firstTokenMs: number | null = null;
  let status: "complete" | "cancelled" | "error" = "complete";
  let failure: { code: string; message: string } | null = null;

  try {
    if (profile.knowledgeMode === "strict" && prep.hadAnySearch && sources.length === 0) {
      // Nothing relevant in the knowledge base: answer deterministically, no model call.
      const text = notFoundAnswer(prep.userText);
      yield { type: "delta", text: sanitizer.push(text) + sanitizer.flush() };
      finishReason = "no_relevant_source";
    } else {
      const params = generationParams(profile, resolved.roleOverride ?? undefined);
      const contextLength = await contextLengthFor(provider, record, version.providerModel, version.baseModel);
      const system = buildSystemPrompt({
        profile,
        version: { version: version.version, baseModel: version.baseModel, fineTuned: Boolean(version.adapterName) },
        hasSources: sources.length > 0,
        hasMemories: memories.length > 0,
        now: new Date(),
      });
      const fit = fitContext({
        system,
        sources,
        renderContext: (s) => buildContextBlock(s, memories),
        history: prep.history,
        user: prep.userText,
        contextLength,
        maxOutputTokens: params.maxTokens,
      });
      const caps = await provider.getCapabilities(version.providerModel);
      const tools = caps.toolCalling ? availableTools(profile, ctx) : [];
      const messages: ChatMessage[] = [...fit.messages];
      let toolCallsSoFar = 0;
      const totals: Usage = { inputTokens: 0, outputTokens: 0, source: "provider" };

      for (let round = 0; round <= profile.maxToolCalls; round++) {
        const pendingCalls: ToolCall[] = [];
        let roundText = "";
        const useTools = tools.length > 0 && toolCallsSoFar < profile.maxToolCalls;
        for await (const ev of provider.stream({
          model: version.providerModel,
          adapter: version.adapterName,
          messages,
          temperature: params.temperature,
          topP: params.topP,
          maxTokens: fit.maxTokens,
          tools: useTools ? tools : undefined,
          signal: input.signal,
          firstTokenTimeoutMs: 180_000,
          totalTimeoutMs: 600_000,
        })) {
          if (ev.type === "delta") {
            roundText += ev.text;
            const out = sanitizer.push(ev.text);
            if (out) yield { type: "delta", text: out };
          } else if (ev.type === "tool_call") {
            pendingCalls.push(ev.call);
          } else {
            totals.inputTokens += ev.result.usage.inputTokens;
            totals.outputTokens += ev.result.usage.outputTokens;
            if (ev.result.usage.source === "estimate") totals.source = "estimate";
            firstTokenMs ??= ev.result.firstTokenMs;
            finishReason = ev.result.finishReason;
          }
        }
        if (!pendingCalls.length) break;
        messages.push({ role: "assistant", content: roundText, toolCalls: pendingCalls });
        for (const call of pendingCalls) {
          const decision = authorizeToolCall(profile, ctx, call, toolCallsSoFar);
          if (!decision.allowed) {
            yield { type: "tool", name: call.name, status: "denied", detail: decision.reason };
            messages.push({ role: "tool", toolCallId: call.id, content: JSON.stringify({ error: decision.reason }) });
            continue;
          }
          toolCallsSoFar++;
          yield { type: "tool", name: call.name, status: "started" };
          const result = await executeTool(decision.def, ctx, decision.args, input.signal);
          messages.push({ role: "tool", toolCallId: call.id, content: result });
          yield { type: "tool", name: call.name, status: "finished" };
        }
      }
      usage = totals;
    }
    const tail = sanitizer.flush();
    if (tail) yield { type: "delta", text: tail };
  } catch (err) {
    const tail = sanitizer.flush();
    if (input.signal.aborted || (err instanceof ProviderError && err.code === "cancelled")) {
      status = "cancelled";
      finishReason = "cancelled";
      if (tail) yield { type: "delta", text: tail };
    } else {
      status = "error";
      failure = mapError(err);
      log.warn("chat.generation_failed", { requestId: ctx.requestId, code: failure.code, error: err instanceof Error ? err.message : String(err) });
    }
  }

  // ---- Phase 2: persist the outcome (always, including cancel and error).
  const final = validateOutput(sanitizer.text, allowed);
  const latencyMs = Date.now() - started;
  await withUser(ctx.userId, async (db) => {
    await db.query(
      `UPDATE ai_messages SET content = $2, status = $3, sources = $4, usage_metadata = $5 WHERE id = $1`,
      [
        prep.assistantMessageId,
        final.text,
        status,
        JSON.stringify(sourceRefs.map((s) => ({ ...s, cited: final.cited.includes(s.id) }))),
        { ...usage, finishReason, latencyMs, firstTokenMs, provider: record.providerName, error: failure?.code ?? null },
      ],
    );
    await db.query("UPDATE ai_conversations SET updated_at = now() WHERE id = $1", [prep.conversationId]);
    await db.query(
      `INSERT INTO ai_usage_events (owner_id, workspace_id, model_profile_id, model_version_id, operation, provider_type,
                                    input_tokens, output_tokens, usage_source, latency_ms, estimated_cost, request_id)
       VALUES ($1, $2, $3, $4, 'chat', $5, $6, $7, $8, $9, $10, $11)`,
      [ctx.userId, ctx.workspaceId, profile.id, version.id, record.providerType, usage.inputTokens, usage.outputTokens, usage.source, latencyMs, estimateCost(record, usage), ctx.requestId],
    );
    if (ctx.via === "api_key") {
      await audit(db, ctx, "chat.api_completion", "model_version", version.id, { apiKeyId: ctx.apiKeyId, status });
    }
  });

  if (status === "error") {
    yield { type: "error", code: failure!.code, message: failure!.message, messageId: prep.assistantMessageId };
    return;
  }
  yield {
    type: "done",
    message: { id: prep.assistantMessageId, content: final.text, status, cited: final.cited, finishReason, usage, latencyMs, firstTokenMs },
  };
}
