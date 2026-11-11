import "server-only";
import type { Db } from "@/lib/db/pool";
import { AppError } from "@/lib/http/errors";
import { detectPii } from "@/lib/security/pii";
import { embedder, embeddingsEnabled, toVectorLiteral } from "../embeddings";
import { termCoverage } from "../rag/retrieve";
import { queryTerms } from "../text/arabic";
import { EMBEDDING_MODELS } from "../models/catalog";

// =============================================================================
// Layer E — Memory. Separate from the knowledge base:
//   * short-term: the recent turns of the current conversation (context manager)
//   * long-term: ai_memories rows — preferences, facts, project context
// Rules enforced here:
//   * nothing is saved automatically: rows are 'explicit' (the user saved it)
//     or 'approved' (the model suggested it and the user approved);
//   * secrets and sensitive identifiers are refused outright;
//   * recall returns only the top-k relevant memories, never all of them;
//   * every query is scoped to owner + workspace (+ profile) and RLS repeats it.
// =============================================================================

export type MemoryKind = "preference" | "fact" | "project";

export interface Memory {
  id: string;
  kind: MemoryKind;
  content: string;
  source: "explicit" | "approved";
  modelProfileId: string | null;
  workspaceId: string;
  createdAt: string;
  lastUsedAt: string | null;
}

const BLOCKED = new Set(["password", "api_key", "private_key", "payment_card", "iban", "saudi_national_id"]);

export function memoryFromRow(r: Record<string, unknown>): Memory {
  return {
    id: r.id as string,
    kind: r.kind as MemoryKind,
    content: r.content as string,
    source: r.source as Memory["source"],
    modelProfileId: (r.model_profile_id as string | null) ?? null,
    workspaceId: r.workspace_id as string,
    createdAt: new Date(r.created_at as string).toISOString(),
    lastUsedAt: r.last_used_at ? new Date(r.last_used_at as string).toISOString() : null,
  };
}

export function assertStorableMemory(content: string): void {
  const blocked = detectPii(content).filter((f) => BLOCKED.has(f.type));
  if (blocked.length) {
    throw new AppError("VALIDATION_FAILED", "Memories cannot contain passwords, keys, card/bank numbers or national IDs", {
      details: { found: [...new Set(blocked.map((b) => b.type))] },
    });
  }
}

/** The memory's embedding, or all-NULL columns when the server has no embedding model. */
async function memoryVector(content: string): Promise<{ vector: string | null; model: string | null; dims: number | null }> {
  if (!embeddingsEnabled()) return { vector: null, model: null, dims: null };
  const emb = embedder();
  const [v] = await emb.embed([content], "passage");
  return { vector: toVectorLiteral(v!), model: emb.model, dims: emb.dims };
}

/**
 * Recall without embeddings: preferences always apply (as with vectors);
 * facts and project notes only when they share query terms.
 */
async function recallByKeywords(
  db: Db,
  ctx: { userId: string; workspaceId: string },
  opts: { query: string; modelProfileId: string; topK: number; includeProject: boolean },
): Promise<Memory[]> {
  const kinds = opts.includeProject ? ["preference", "fact", "project"] : ["preference", "fact"];
  const r = await db.query(
    `SELECT * FROM ai_memories
      WHERE owner_id = $1 AND workspace_id = $2
        AND (model_profile_id IS NULL OR model_profile_id = $3)
        AND kind = ANY($4::text[])
      ORDER BY last_used_at DESC NULLS LAST, created_at DESC
      LIMIT 500`,
    [ctx.userId, ctx.workspaceId, opts.modelProfileId, kinds],
  );
  const terms = queryTerms(opts.query);
  const need = Math.min(2, terms.length);
  const rows = r.rows
    .map((row) => ({ row, hits: row.kind === "preference" ? Infinity : need > 0 ? termCoverage(terms, row.content as string) : 0 }))
    .filter((x) => x.row.kind === "preference" || (need > 0 && x.hits >= need))
    .sort((a, b) => b.hits - a.hits)
    .slice(0, opts.topK)
    .map((x) => x.row);
  if (rows.length) {
    await db.query("UPDATE ai_memories SET last_used_at = now() WHERE id = ANY($1::uuid[])", [rows.map((x) => x.id)]);
  }
  return rows.map(memoryFromRow);
}

export async function saveMemory(
  db: Db,
  ctx: { userId: string; workspaceId: string },
  input: { kind: MemoryKind; content: string; modelProfileId?: string | null; source?: "explicit" | "approved" },
): Promise<Memory> {
  const content = input.content.trim();
  assertStorableMemory(content);
  const { vector, model, dims } = await memoryVector(content);
  const r = await db.query(
    `INSERT INTO ai_memories (owner_id, workspace_id, model_profile_id, kind, content, source, embedding, embedding_model, embedding_dims)
     VALUES ($1, $2, $3, $4, $5, $6, $7::vector, $8, $9) RETURNING *`,
    [ctx.userId, ctx.workspaceId, input.modelProfileId ?? null, input.kind, content, input.source ?? "explicit", vector, model, dims],
  );
  return memoryFromRow(r.rows[0]);
}

export async function listMemories(db: Db, ctx: { userId: string; workspaceId: string }): Promise<Memory[]> {
  const r = await db.query("SELECT * FROM ai_memories WHERE owner_id = $1 AND workspace_id = $2 ORDER BY created_at DESC LIMIT 500", [
    ctx.userId,
    ctx.workspaceId,
  ]);
  return r.rows.map(memoryFromRow);
}

export async function deleteMemory(db: Db, ctx: { userId: string }, id: string): Promise<void> {
  const r = await db.query("DELETE FROM ai_memories WHERE id = $1 AND owner_id = $2", [id, ctx.userId]);
  if (!r.rowCount) throw new AppError("NOT_FOUND", "Memory not found");
}

export async function updateMemory(db: Db, ctx: { userId: string }, id: string, content: string): Promise<Memory> {
  assertStorableMemory(content);
  const { vector, model, dims } = await memoryVector(content.trim());
  const r = await db.query(
    `UPDATE ai_memories SET content = $3, embedding = $4::vector, embedding_model = $5, embedding_dims = $6
      WHERE id = $1 AND owner_id = $2 RETURNING *`,
    [id, ctx.userId, content.trim(), vector, model, dims],
  );
  if (!r.rowCount) throw new AppError("NOT_FOUND", "Memory not found");
  return memoryFromRow(r.rows[0]);
}

/** Top-k memories relevant to the query, for this user, workspace and (optionally) model. */
export async function recallMemories(
  db: Db,
  ctx: { userId: string; workspaceId: string },
  opts: { query: string; modelProfileId: string; topK: number; includeProject: boolean },
): Promise<Memory[]> {
  if (opts.topK <= 0) return [];
  if (!embeddingsEnabled()) return recallByKeywords(db, ctx, opts);
  const emb = embedder();
  const [qv] = await emb.embed([opts.query], "query");
  const dims = EMBEDDING_MODELS[emb.model].dims;
  const kinds = opts.includeProject ? ["preference", "fact", "project"] : ["preference", "fact"];
  const r = await db.query(
    `SELECT *, 1 - (embedding::vector(${dims}) <=> $5::vector(${dims})) AS similarity
       FROM ai_memories
      WHERE owner_id = $1 AND workspace_id = $2
        AND (model_profile_id IS NULL OR model_profile_id = $3)
        AND kind = ANY($4::text[])
        AND embedding_model = $6
      ORDER BY embedding::vector(${dims}) <=> $5::vector(${dims})
      LIMIT $7`,
    [ctx.userId, ctx.workspaceId, opts.modelProfileId, kinds, toVectorLiteral(qv!), emb.model, opts.topK],
  );
  // Preferences always apply; facts/project notes only when reasonably related.
  const rows = r.rows.filter((row) => row.kind === "preference" || Number(row.similarity) >= 0.78);
  if (rows.length) {
    await db.query("UPDATE ai_memories SET last_used_at = now() WHERE id = ANY($1::uuid[])", [rows.map((x) => x.id)]);
  }
  return rows.map(memoryFromRow);
}
