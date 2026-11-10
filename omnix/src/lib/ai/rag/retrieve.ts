import "server-only";
import type { Db } from "@/lib/db/pool";
import { embedder, toVectorLiteral } from "../embeddings";
import { EMBEDDING_MODELS, type EmbeddingModelId } from "../models/catalog";
import { queryTerms } from "../text/arabic";

export interface RetrievedChunk {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  filename: string;
  chunkIndex: number;
  content: string;
  page: number | null;
  heading: string | null;
  similarity: number | null;
  keywordRank: number | null;
  /** Reciprocal-rank-fusion score, 0..1 normalised. */
  score: number;
  /** True when the chunk cleared the relevance bar (keyword hit or strong semantic match). */
  relevant: boolean;
}

export interface SearchOptions {
  workspaceId: string;
  query: string;
  topK?: number;
  tags?: string[];
  documentIds?: string[];
  mode?: "hybrid" | "semantic" | "keyword";
  /** Cosine similarity at or above which a semantic-only hit counts as relevant. */
  minSimilarity?: number;
}

/**
 * Calibrated per embedding model: e5 cosine scores sit in a narrow high band
 * (unrelated text still scores ~0.75), so a raw 0.5 cut-off would accept
 * everything. Values were calibrated against real Arabic and English
 * queries in tests/integration/rag.test.ts.
 */
export const RELEVANCE_SIMILARITY: Record<EmbeddingModelId, number> = {
  "intfloat/multilingual-e5-small": 0.83,
  "BAAI/bge-m3": 0.55,
};

const RRF_K = 60;

/** Model name and dimension are inlined from the fixed registry (never user input) so the planner can use the partial HNSW index. */
function vectorSql(model: EmbeddingModelId): { cast: string; model: string } {
  const dims = EMBEDDING_MODELS[model].dims;
  if (!Number.isInteger(dims)) throw new Error("bad dims");
  return { cast: `vector(${dims})`, model: model.replace(/'/g, "''") };
}

export async function hybridSearch(db: Db, opts: SearchOptions): Promise<RetrievedChunk[]> {
  const topK = Math.min(Math.max(opts.topK ?? 6, 1), 20);
  const mode = opts.mode ?? "hybrid";
  const pool = Math.max(topK * 3, 20);
  const emb = embedder();
  const { cast, model } = vectorSql(emb.model);
  const filters: string[] = ["c.workspace_id = $1", "d.processing_status = 'ready'"];
  const params: unknown[] = [opts.workspaceId];
  if (opts.tags?.length) {
    params.push(opts.tags);
    filters.push(`d.tags && $${params.length}::text[]`);
  }
  if (opts.documentIds?.length) {
    params.push(opts.documentIds);
    filters.push(`d.id = ANY($${params.length}::uuid[])`);
  }
  const where = filters.join(" AND ");
  const select = `c.id, c.document_id, c.chunk_index, c.content, c.metadata, d.title, d.filename`;

  type Row = { id: string; document_id: string; chunk_index: number; content: string; metadata: { page?: number; heading?: string }; title: string; filename: string };
  const semantic: (Row & { similarity: number })[] = [];
  const keyword: (Row & { rank: number })[] = [];

  if (mode !== "keyword") {
    const [qv] = await emb.embed([opts.query], "query");
    const vParams = [...params, toVectorLiteral(qv!)];
    const vi = vParams.length;
    // Higher ef_search keeps recall up when RLS/workspace filters prune HNSW candidates.
    await db.query("SET LOCAL hnsw.ef_search = 100");
    const r = await db.query<Row & { similarity: number }>(
      `SELECT ${select}, 1 - (c.embedding::${cast} <=> $${vi}::${cast}) AS similarity
         FROM ai_knowledge_chunks c JOIN ai_knowledge_documents d ON d.id = c.document_id
        WHERE ${where} AND c.embedding_model = '${model}'
        ORDER BY c.embedding::${cast} <=> $${vi}::${cast}
        LIMIT ${pool}`,
      vParams,
    );
    semantic.push(...r.rows);
  }

  const terms = queryTerms(opts.query);
  if (mode !== "semantic" && terms.length) {
    // Terms contain only letters/digits (see queryTerms), so they cannot carry tsquery operators.
    const tsq = terms.map((t) => (t.length >= 4 ? `${t}:*` : t)).join(" | ");
    const kParams = [...params, tsq];
    const ki = kParams.length;
    const r = await db.query<Row & { rank: number }>(
      `SELECT ${select}, ts_rank_cd(c.search_tsv, q) AS rank
         FROM ai_knowledge_chunks c JOIN ai_knowledge_documents d ON d.id = c.document_id,
              to_tsquery('simple', $${ki}) q
        WHERE ${where} AND c.search_tsv @@ q
        ORDER BY rank DESC
        LIMIT ${pool}`,
      kParams,
    );
    keyword.push(...r.rows);
  }

  const minSim = opts.minSimilarity ?? RELEVANCE_SIMILARITY[emb.model];
  const fused = new Map<string, RetrievedChunk & { rrf: number }>();
  const upsert = (row: Row) => {
    let f = fused.get(row.id);
    if (!f) {
      f = {
        chunkId: row.id,
        documentId: row.document_id,
        documentTitle: row.title,
        filename: row.filename,
        chunkIndex: row.chunk_index,
        content: row.content,
        page: row.metadata?.page ?? null,
        heading: row.metadata?.heading ?? null,
        similarity: null,
        keywordRank: null,
        score: 0,
        relevant: false,
        rrf: 0,
      };
      fused.set(row.id, f);
    }
    return f;
  };
  semantic.forEach((row, i) => {
    const f = upsert(row);
    f.similarity = Number(row.similarity);
    f.rrf += 1 / (RRF_K + i + 1);
    if (f.similarity >= minSim) f.relevant = true;
  });
  keyword.forEach((row, i) => {
    const f = upsert(row);
    f.keywordRank = i + 1;
    f.rrf += 1 / (RRF_K + i + 1);
    f.relevant = true;
  });

  const maxRrf = (mode === "hybrid" ? 2 : 1) / (RRF_K + 1);
  return [...fused.values()]
    .sort((a, b) => b.rrf - a.rrf)
    .slice(0, topK)
    .map(({ rrf, ...c }) => ({ ...c, score: Math.min(1, rrf / maxRrf) }));
}
