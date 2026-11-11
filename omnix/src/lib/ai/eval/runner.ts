import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { withUser, type Db } from "@/lib/db/pool";
import { AppError } from "@/lib/http/errors";
import { log } from "@/lib/log";
import { embedder, toVectorLiteral } from "../embeddings";
import { getProfile, getVersion } from "../models/service";
import { buildContextBlock, buildSystemPrompt, type SourceForPrompt } from "../prompt/system-prompt";
import { loadProvider } from "../providers/registry";
import { ProviderError, type ChatMessage, type ModelProvider } from "../providers/types";
import { hybridSearch } from "../rag/retrieve";
import { searchText } from "../text/arabic";
import { estimateTokens } from "../tokens";
import { scoreCase, type Observation } from "./scorers";
import { RETRIEVAL_FIXTURES, SUITE, SUITE_VERSION, THRESHOLDS, type Category, type EvalCase } from "./suite";

export type EvaluationType = "full" | Category;

export async function createRun(db: Db, ctx: { userId: string }, versionId: string, type: EvaluationType) {
  await getVersion(db, versionId);
  const busy = await db.query("SELECT 1 FROM ai_evaluation_runs WHERE model_version_id = $1 AND status IN ('queued', 'running')", [versionId]);
  if (busy.rowCount) throw new AppError("CONFLICT", "An evaluation of this version is already in progress");
  const r = await db.query(
    `INSERT INTO ai_evaluation_runs (model_version_id, owner_id, evaluation_type, suite_version, status) VALUES ($1, $2, $3, $4, 'queued') RETURNING *`,
    [versionId, ctx.userId, type, SUITE_VERSION],
  );
  return r.rows[0];
}

/** Fixture documents exist only inside a savepoint that is always rolled back: evaluation never touches real knowledge. */
async function retrievalTop1(db: Db, workspaceId: string, ownerId: string, query: string): Promise<string | null> {
  await db.query("SAVEPOINT omnix_eval_retrieval");
  try {
    const emb = embedder();
    const ids = new Map<string, string>();
    for (const [key, f] of Object.entries(RETRIEVAL_FIXTURES)) {
      const id = randomUUID();
      ids.set(id, key);
      await db.query(
        `INSERT INTO ai_knowledge_documents (id, owner_id, workspace_id, filename, title, mime_type, byte_size, sha256, storage_path, processing_status, chunk_count, embedding_model)
         VALUES ($1, $2, $3, $4, $5, 'text/plain', $6, $7, $8, 'ready', 1, $9)`,
        [id, ownerId, workspaceId, `${key}.txt`, f.title, Buffer.byteLength(f.content), createHash("sha256").update(`${id}${f.content}`).digest("hex"), `eval/${id}`, emb.model],
      );
      const [v] = await emb.embed([f.content], "passage");
      await db.query(
        `INSERT INTO ai_knowledge_chunks (document_id, workspace_id, chunk_index, content, search_text, token_count, embedding, embedding_model, embedding_dims)
         VALUES ($1, $2, 0, $3, $4, $5, $6::vector, $7, $8)`,
        [id, workspaceId, f.content, searchText(f.content), estimateTokens(f.content), toVectorLiteral(v!), emb.model, emb.dims],
      );
    }
    const hits = await hybridSearch(db, { workspaceId, query, topK: 3, documentIds: [...ids.keys()] });
    return hits[0] ? (ids.get(hits[0].documentId) ?? null) : null;
  } finally {
    await db.query("ROLLBACK TO SAVEPOINT omnix_eval_retrieval");
  }
}

async function observe(
  provider: ModelProvider,
  model: string,
  adapter: string | null,
  system: string,
  c: EvalCase,
): Promise<Observation & { usage: { input: number; output: number } }> {
  const sources: SourceForPrompt[] = (c.sources ?? []).map((s, i) => ({
    sourceId: `S${i + 1}`,
    documentTitle: s.title,
    content: s.content,
    chunkId: `eval-${i}`,
    documentId: `eval-${i}`,
    filename: "eval",
    chunkIndex: 0,
    page: null,
    heading: null,
    similarity: 1,
    keywordRank: 1,
    score: 1,
    relevant: true,
  }));
  const ctxBlock = buildContextBlock(sources, []);
  const messages: ChatMessage[] = [
    { role: "system", content: system },
    ...(ctxBlock ? [{ role: "system" as const, content: ctxBlock }] : []),
    { role: "user", content: c.input },
  ];
  const t = performance.now();
  const r = await provider.generate({
    model,
    adapter,
    messages,
    temperature: 0,
    maxTokens: 160,
    tools: c.tools,
    firstTokenTimeoutMs: 120_000,
    totalTimeoutMs: 180_000,
  });
  return {
    text: r.text,
    toolCalls: r.toolCalls,
    firstTokenMs: r.firstTokenMs,
    totalMs: Math.round(performance.now() - t),
    usage: { input: r.usage.inputTokens, output: r.usage.outputTokens },
  };
}

export async function runEvaluation(userId: string, runId: string): Promise<void> {
  const claimed = await withUser(userId, async (db) => {
    const r = await db.query("UPDATE ai_evaluation_runs SET status = 'running', started_at = now() WHERE id = $1 AND status = 'queued' RETURNING *", [runId]);
    if (!r.rowCount) return null;
    const run = r.rows[0];
    const version = await getVersion(db, run.model_version_id);
    const profile = await getProfile(db, version.modelProfileId);
    if (run.evaluation_type === "full") {
      await db.query("UPDATE ai_model_versions SET evaluation_status = 'running' WHERE id = $1 AND status <> 'deployed'", [version.id]);
    }
    const { provider, record } = await loadProvider(db, version.providerId);
    return { run, version, profile, provider, record };
  });
  if (!claimed) return;
  const { run, version, profile, provider, record } = claimed;
  const cases = run.evaluation_type === "full" ? SUITE : SUITE.filter((c) => c.category === run.evaluation_type);
  const per: Record<string, { total: number; passed: number; skipped: number }> = {};
  let tokensIn = 0;
  let tokensOut = 0;
  let providerFailures = 0;
  let modelCases = 0;
  const started = Date.now();

  try {
    const caps = await provider.getCapabilities(version.providerModel);
    const identity = { version: version.version, baseModel: version.baseModel, fineTuned: Boolean(version.adapterName) };
    for (const c of cases) {
      per[c.category] ??= { total: 0, passed: 0, skipped: 0 };
      per[c.category]!.total++;
      let passed: boolean | null;
      let actual = "";
      let latency: number | null = null;
      let detail: Record<string, unknown> = {};

      if (c.category === "tool_calling" && !caps.toolCalling) {
        passed = null;
        detail = { skipped: `provider ${record.providerName} does not support tool calling` };
      } else if (c.category === "retrieval") {
        const top = await withUser(userId, (db) => retrievalTop1(db, profile.workspaceId, userId, c.input));
        const s = scoreCase(c.checks, { text: "", toolCalls: [], firstTokenMs: null, totalMs: 0, retrievedTop1: top });
        passed = s.passed;
        actual = top ?? "";
        detail = { reason: s.reason };
      } else {
        modelCases++;
        try {
          const system = buildSystemPrompt({ profile, version: identity, hasSources: Boolean(c.sources?.length), hasMemories: false, now: new Date() });
          const o = await observe(provider, version.providerModel, version.adapterName, system, c);
          tokensIn += o.usage.input;
          tokensOut += o.usage.output;
          const s = scoreCase(c.checks, o);
          passed = s.passed;
          actual = o.text || (o.toolCalls.length ? JSON.stringify(o.toolCalls) : "");
          latency = o.totalMs;
          detail = { reason: s.reason, firstTokenMs: o.firstTokenMs, toolCalls: o.toolCalls };
        } catch (err) {
          if (err instanceof ProviderError && ["unavailable", "timeout"].includes(err.code)) providerFailures++;
          passed = false;
          detail = { error: err instanceof Error ? err.message.slice(0, 500) : "failed" };
        }
      }
      if (passed === null) per[c.category]!.skipped++;
      else if (passed) per[c.category]!.passed++;
      await withUser(userId, (db) =>
        db.query(
          `INSERT INTO ai_evaluation_cases (evaluation_run_id, case_key, category, input, expected_output, actual_output, score, passed, latency_ms, detail)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [runId, c.key, c.category, c.input, c.expected, actual.slice(0, 20_000), passed === null ? null : passed ? 1 : 0, passed, latency, detail],
        ),
      );
    }

    const categories = Object.fromEntries(
      Object.entries(per).map(([cat, v]) => {
        const evaluated = v.total - v.skipped;
        const rate = evaluated ? v.passed / evaluated : null;
        const threshold = THRESHOLDS[cat as Category];
        return [cat, { ...v, evaluated, rate, threshold, met: rate === null ? null : rate >= threshold - 1e-9 }];
      }),
    );
    const evaluated = Object.values(per).reduce((n, v) => n + v.total - v.skipped, 0);
    const passedCount = Object.values(per).reduce((n, v) => n + v.passed, 0);
    const skipped = Object.values(per).reduce((n, v) => n + v.skipped, 0);
    const allMet = Object.values(categories).every((c) => c.met !== false);
    const status = modelCases > 0 && providerFailures === modelCases ? "error" : allMet ? "passed" : "failed";

    await withUser(userId, async (db) => {
      await db.query(
        `UPDATE ai_evaluation_runs SET status = $2, results = $3, total_count = $4, passed_count = $5, skipped_count = $6, score = $7,
                error = $8, completed_at = now() WHERE id = $1`,
        [
          runId, status,
          { categories, provider: record.providerName, model: version.providerModel, adapter: version.adapterName, durationMs: Date.now() - started, tokens: { input: tokensIn, output: tokensOut } },
          cases.length, passedCount, skipped, evaluated ? passedCount / evaluated : null,
          status === "error" ? "The model provider was unreachable for every model case" : null,
        ],
      );
      if (run.evaluation_type === "full" && version.status !== "deployed") {
        await db.query("UPDATE ai_model_versions SET evaluation_status = $2 WHERE id = $1", [version.id, status === "passed" ? "passed" : "failed"]);
      }
      await db.query(
        `INSERT INTO ai_usage_events (owner_id, workspace_id, model_profile_id, model_version_id, operation, provider_type, input_tokens, output_tokens, usage_source, latency_ms)
         VALUES ($1, $2, $3, $4, 'evaluation', $5, $6, $7, 'provider', $8)`,
        [userId, profile.workspaceId, profile.id, version.id, record.providerType, tokensIn, tokensOut, Date.now() - started],
      );
    });
  } catch (err) {
    log.error("evaluation.failed", { runId, error: err instanceof Error ? err : String(err) });
    await withUser(userId, async (db) => {
      await db.query("UPDATE ai_evaluation_runs SET status = 'error', error = $2, completed_at = now() WHERE id = $1", [runId, (err as Error).message?.slice(0, 2000) ?? "failed"]);
      if (run.evaluation_type === "full") {
        await db.query("UPDATE ai_model_versions SET evaluation_status = 'failed' WHERE id = $1 AND status <> 'deployed'", [version.id]);
      }
    });
  }
}

/** Base vs customised: latest completed full run of each version, per category and per case. */
export async function compareVersions(db: Db, baselineId: string, candidateId: string) {
  const latest = async (vid: string) => {
    const r = await db.query(
      `SELECT * FROM ai_evaluation_runs WHERE model_version_id = $1 AND evaluation_type = 'full' AND status IN ('passed', 'failed')
        ORDER BY completed_at DESC LIMIT 1`,
      [vid],
    );
    if (!r.rowCount) return null;
    const cases = await db.query("SELECT case_key, category, passed, actual_output FROM ai_evaluation_cases WHERE evaluation_run_id = $1", [r.rows[0].id]);
    return { run: r.rows[0], cases: new Map(cases.rows.map((c) => [c.case_key as string, c])) };
  };
  const [a, b] = await Promise.all([latest(baselineId), latest(candidateId)]);
  if (!a || !b) throw new AppError("PRECONDITION_FAILED", "Both versions need a completed full evaluation run");
  if (a.run.suite_version !== b.run.suite_version) throw new AppError("PRECONDITION_FAILED", "Runs used different suite versions and are not comparable");
  const cats = new Set([...Object.keys(a.run.results.categories ?? {}), ...Object.keys(b.run.results.categories ?? {})]);
  return {
    suiteVersion: a.run.suite_version,
    baseline: { versionId: baselineId, runId: a.run.id, score: a.run.score === null ? null : Number(a.run.score), status: a.run.status },
    candidate: { versionId: candidateId, runId: b.run.id, score: b.run.score === null ? null : Number(b.run.score), status: b.run.status },
    categories: [...cats].map((c) => {
      const x = a.run.results.categories?.[c];
      const y = b.run.results.categories?.[c];
      return { category: c, baseline: x?.rate ?? null, candidate: y?.rate ?? null, delta: x?.rate != null && y?.rate != null ? y.rate - x.rate : null };
    }),
    cases: [...a.cases.keys()].map((k) => {
      const x = a.cases.get(k)!;
      const y = b.cases.get(k);
      const change = x.passed === y?.passed ? "same" : y?.passed === true ? "improved" : y?.passed === false ? "regressed" : "n/a";
      return { caseKey: k, category: x.category, baseline: x.passed, candidate: y?.passed ?? null, change };
    }),
  };
}
