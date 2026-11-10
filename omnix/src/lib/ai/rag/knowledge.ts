import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { audit } from "@/lib/audit";
import type { AuthContext, ReqCtx } from "@/lib/auth/session";
import { env } from "@/lib/config/env";
import { withUser, type Db } from "@/lib/db/pool";
import { AppError } from "@/lib/http/errors";
import { log } from "@/lib/log";
import { safeFilename, sniffKnowledgeFile, type KnowledgeMime } from "@/lib/security/file-sniff";
import { deleteObject, getObject, putObject } from "@/lib/storage";
import { embedder, toVectorLiteral } from "../embeddings";
import { searchText } from "../text/arabic";
import { chunkSegments } from "./chunk";
import { extractText } from "./extract";

export interface KnowledgeDocument {
  id: string;
  ownerId: string;
  workspaceId: string;
  filename: string;
  title: string;
  mimeType: KnowledgeMime;
  byteSize: number;
  sha256: string;
  category: string | null;
  tags: string[];
  processingStatus: "pending" | "processing" | "ready" | "failed";
  processingError: string | null;
  chunkCount: number;
  embeddingModel: string | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export function documentFromRow(r: Record<string, unknown>): KnowledgeDocument {
  return {
    id: r.id as string,
    ownerId: r.owner_id as string,
    workspaceId: r.workspace_id as string,
    filename: r.filename as string,
    title: r.title as string,
    mimeType: r.mime_type as KnowledgeMime,
    byteSize: Number(r.byte_size),
    sha256: r.sha256 as string,
    category: (r.category as string | null) ?? null,
    tags: (r.tags as string[]) ?? [],
    processingStatus: r.processing_status as KnowledgeDocument["processingStatus"],
    processingError: (r.processing_error as string | null) ?? null,
    chunkCount: Number(r.chunk_count),
    embeddingModel: (r.embedding_model as string | null) ?? null,
    revision: Number(r.revision),
    createdAt: new Date(r.created_at as string).toISOString(),
    updatedAt: new Date(r.updated_at as string).toISOString(),
  };
}

export interface UploadInput {
  filename: string;
  data: Uint8Array;
  title?: string;
  category?: string | null;
  tags?: string[];
  /** Replace the content of an existing document (new revision). */
  replaceDocumentId?: string;
}

export type ManualTextInput = { title: string; text: string; category?: string | null; tags?: string[] };

function validateUpload(filename: string, data: Uint8Array): KnowledgeMime {
  const max = env().OMNIX_MAX_UPLOAD_MB * 1024 * 1024;
  if (data.byteLength > max) throw new AppError("PAYLOAD_TOO_LARGE", `Files are limited to ${env().OMNIX_MAX_UPLOAD_MB} MB`);
  const sniff = sniffKnowledgeFile(filename, data);
  if (!sniff.ok) throw new AppError("UNSUPPORTED_MEDIA_TYPE", sniff.reason ?? "Unsupported file");
  return sniff.mime!;
}

const cleanTags = (tags?: string[]) =>
  [...new Set((tags ?? []).map((t) => t.trim().toLowerCase()).filter((t) => /^[\p{L}\p{N}_-]{1,40}$/u.test(t)))].slice(0, 20);

/** Stores the file and creates (or revises) the document row. Processing happens in processDocument. */
export async function createDocument(ctx: ReqCtx, input: UploadInput): Promise<KnowledgeDocument> {
  const filename = safeFilename(input.filename);
  const mime = validateUpload(filename, input.data);
  const sha = createHash("sha256").update(input.data).digest("hex");
  const title = (input.title?.trim() || filename.replace(/\.[^.]+$/, "")).slice(0, 255);

  return withUser(ctx.userId, async (db) => {
    if (input.replaceDocumentId) {
      const cur = await db.query("SELECT * FROM ai_knowledge_documents WHERE id = $1 AND workspace_id = $2 FOR UPDATE", [
        input.replaceDocumentId,
        ctx.workspaceId,
      ]);
      if (!cur.rowCount) throw new AppError("NOT_FOUND", "Document not found");
      const old = documentFromRow(cur.rows[0]);
      const storagePath = `knowledge/${ctx.workspaceId}/${old.id}/${sha}`;
      await putObject(storagePath, input.data);
      const r = await db.query(
        `UPDATE ai_knowledge_documents
            SET filename = $2, title = $3, mime_type = $4, byte_size = $5, sha256 = $6, storage_path = $7,
                processing_status = 'pending', processing_error = NULL, revision = revision + 1,
                category = COALESCE($8, category), tags = CASE WHEN $9::text[] = '{}' THEN tags ELSE $9 END
          WHERE id = $1 RETURNING *`,
        [old.id, filename, title, mime, input.data.byteLength, sha, storagePath, input.category ?? null, cleanTags(input.tags)],
      );
      if (old.sha256 !== sha) await deleteObject(`knowledge/${ctx.workspaceId}/${old.id}/${old.sha256}`).catch(() => {});
      await audit(db, ctx, "knowledge.document_revised", "knowledge_document", old.id, { revision: old.revision + 1 });
      return documentFromRow(r.rows[0]);
    }

    const dup = await db.query("SELECT * FROM ai_knowledge_documents WHERE workspace_id = $1 AND sha256 = $2", [ctx.workspaceId, sha]);
    if (dup.rowCount) {
      throw new AppError("CONFLICT", "This file is already in the knowledge base", { details: { documentId: dup.rows[0].id } });
    }
    const id = randomUUID();
    const storagePath = `knowledge/${ctx.workspaceId}/${id}/${sha}`;
    await putObject(storagePath, input.data);
    const r = await db.query(
      `INSERT INTO ai_knowledge_documents
         (id, owner_id, workspace_id, filename, title, mime_type, byte_size, sha256, storage_path, category, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [id, ctx.userId, ctx.workspaceId, filename, title, mime, input.data.byteLength, sha, storagePath, input.category ?? null, cleanTags(input.tags)],
    );
    await audit(db, ctx, "knowledge.document_uploaded", "knowledge_document", id, { mime, bytes: input.data.byteLength });
    return documentFromRow(r.rows[0]);
  });
}

export function createTextDocument(ctx: ReqCtx, input: ManualTextInput): Promise<KnowledgeDocument> {
  const slug = input.title.replace(/[^\p{L}\p{N}]+/gu, "-").slice(0, 60) || "note";
  return createDocument(ctx, {
    filename: `${slug}.md`,
    data: new TextEncoder().encode(`# ${input.title}\n\n${input.text}`),
    title: input.title,
    category: input.category,
    tags: input.tags,
  });
}

/**
 * Extract → clean → chunk → embed → store. Runs as the document's uploader
 * (RLS applies). Embedding happens outside any transaction so a large file
 * never holds a database connection open while the CPU works.
 */
export async function processDocument(userId: string, documentId: string): Promise<KnowledgeDocument> {
  const claimed = await withUser(userId, async (db) => {
    const r = await db.query(
      `UPDATE ai_knowledge_documents SET processing_status = 'processing', processing_error = NULL
        WHERE id = $1 AND processing_status IN ('pending', 'failed') RETURNING *`,
      [documentId],
    );
    return r.rows[0] ? documentFromRow(r.rows[0]) : null;
  });
  if (!claimed) {
    const cur = await withUser(userId, (db) => db.query("SELECT * FROM ai_knowledge_documents WHERE id = $1", [documentId]));
    if (!cur.rowCount) throw new AppError("NOT_FOUND", "Document not found");
    return documentFromRow(cur.rows[0]);
  }
  const started = Date.now();
  try {
    const row = await withUser(userId, (db) => db.query<{ storage_path: string }>("SELECT storage_path FROM ai_knowledge_documents WHERE id = $1", [documentId]));
    const data = await getObject(row.rows[0]!.storage_path);
    const segments = await extractText(claimed.mimeType, data);
    const chunks = chunkSegments(segments);
    if (chunks.length === 0) throw new AppError("VALIDATION_FAILED", "No text chunks could be produced");
    if (chunks.length > 5000) throw new AppError("PAYLOAD_TOO_LARGE", "Document produces more than 5000 chunks");
    const emb = embedder();
    const vectors = await emb.embed(chunks.map((c) => c.content), "passage");

    return await withUser(userId, async (db) => {
      await db.query("DELETE FROM ai_knowledge_chunks WHERE document_id = $1", [documentId]);
      for (let i = 0; i < chunks.length; i += 100) {
        const batch = chunks.slice(i, i + 100);
        const values: unknown[] = [];
        const tuples = batch.map((c, j) => {
          const b = values.length;
          values.push(documentId, claimed.workspaceId, c.index, c.content, searchText(c.content), c.tokenCount, c.metadata, toVectorLiteral(vectors[i + j]!), emb.model, emb.dims);
          return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6}, $${b + 7}, $${b + 8}::vector, $${b + 9}, $${b + 10})`;
        });
        await db.query(
          `INSERT INTO ai_knowledge_chunks
             (document_id, workspace_id, chunk_index, content, search_text, token_count, metadata, embedding, embedding_model, embedding_dims)
           VALUES ${tuples.join(", ")}`,
          values,
        );
      }
      const r = await db.query(
        `UPDATE ai_knowledge_documents SET processing_status = 'ready', chunk_count = $2, embedding_model = $3 WHERE id = $1 RETURNING *`,
        [documentId, chunks.length, emb.model],
      );
      await db.query(
        `INSERT INTO ai_usage_events (owner_id, workspace_id, operation, provider_type, input_tokens, usage_source, latency_ms)
         VALUES ($1, $2, 'ingestion', $3, $4, 'estimate', $5)`,
        [userId, claimed.workspaceId, emb.model, chunks.reduce((n, c) => n + c.tokenCount, 0), Date.now() - started],
      );
      return documentFromRow(r.rows[0]);
    });
  } catch (err) {
    const message = err instanceof AppError ? err.message : "Processing failed";
    log.warn("knowledge.processing_failed", { documentId, error: err instanceof Error ? err.message : String(err) });
    await withUser(userId, (db) =>
      db.query("UPDATE ai_knowledge_documents SET processing_status = 'failed', processing_error = $2 WHERE id = $1", [documentId, message.slice(0, 2000)]),
    );
    throw err;
  }
}

export async function listDocuments(db: Db, workspaceId: string, q?: { search?: string; tag?: string; category?: string }): Promise<KnowledgeDocument[]> {
  const params: unknown[] = [workspaceId];
  let where = "workspace_id = $1";
  if (q?.search) {
    params.push(`%${q.search.replace(/[%_\\]/g, "\\$&")}%`);
    where += ` AND (title ILIKE $${params.length} OR filename ILIKE $${params.length})`;
  }
  if (q?.tag) {
    params.push(q.tag);
    where += ` AND $${params.length} = ANY(tags)`;
  }
  if (q?.category) {
    params.push(q.category);
    where += ` AND category = $${params.length}`;
  }
  const r = await db.query(`SELECT * FROM ai_knowledge_documents WHERE ${where} ORDER BY created_at DESC LIMIT 500`, params);
  return r.rows.map(documentFromRow);
}

export async function deleteDocument(ctx: ReqCtx, documentId: string): Promise<void> {
  await withUser(ctx.userId, async (db) => {
    const r = await db.query("DELETE FROM ai_knowledge_documents WHERE id = $1 AND workspace_id = $2 RETURNING storage_path", [
      documentId,
      ctx.workspaceId,
    ]);
    if (!r.rowCount) throw new AppError("NOT_FOUND", "Document not found");
    await deleteObject(r.rows[0].storage_path).catch(() => {});
    await audit(db, ctx, "knowledge.document_deleted", "knowledge_document", documentId);
  });
}

/** Marks every document for re-processing (e.g. after switching embedding model). */
export async function reindexWorkspace(ctx: ReqCtx): Promise<number> {
  return withUser(ctx.userId, async (db) => {
    const r = await db.query(
      `UPDATE ai_knowledge_documents SET processing_status = 'pending'
        WHERE workspace_id = $1 AND processing_status IN ('ready', 'failed') RETURNING id`,
      [ctx.workspaceId],
    );
    await audit(db, ctx, "knowledge.reindex_requested", "workspace", ctx.workspaceId, { documents: r.rowCount });
    return r.rowCount ?? 0;
  });
}
