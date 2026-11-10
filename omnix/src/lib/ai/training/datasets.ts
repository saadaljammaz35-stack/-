import "server-only";
import { createHash } from "node:crypto";
import { audit } from "@/lib/audit";
import type { ReqCtx } from "@/lib/auth/session";
import type { Db } from "@/lib/db/pool";
import { AppError } from "@/lib/http/errors";
import { detectPii } from "@/lib/security/pii";
import { arabicRatio } from "../text/arabic";
import { estimateTokens } from "../tokens";

export interface ChatRecord {
  messages: { role: "system" | "user" | "assistant"; content: string }[];
}

export const MIN_VALID_ITEMS = 10;
const MAX_ITEM_TOKENS = 8192;

export interface Dataset {
  id: string;
  name: string;
  description: string;
  datasetType: "sft_chat" | "sft_instruction";
  status: "draft" | "validating" | "valid" | "invalid" | "archived";
  recordCount: number;
  validCount: number;
  rightsStatement: string | null;
  rightsConfirmedAt: string | null;
  lastValidation: ValidationReport | null;
  snapshotHash: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ValidationReport {
  validatedAt: string;
  total: number;
  valid: number;
  invalid: number;
  duplicates: number;
  piiFlagged: number;
  splits: { train: number; validation: number; test: number };
  tokens: { min: number; median: number; max: number; total: number };
  arabicShare: number;
  issues: { itemId: string; status: string; errors: string[] }[];
  readyForTraining: boolean;
  blockers: string[];
}

export function datasetFromRow(r: Record<string, unknown>): Dataset {
  return {
    id: r.id as string,
    name: r.name as string,
    description: r.description as string,
    datasetType: r.dataset_type as Dataset["datasetType"],
    status: r.status as Dataset["status"],
    recordCount: Number(r.record_count),
    validCount: Number(r.valid_count),
    rightsStatement: (r.rights_statement as string | null) ?? null,
    rightsConfirmedAt: r.rights_confirmed_at ? new Date(r.rights_confirmed_at as string).toISOString() : null,
    lastValidation: (r.last_validation as ValidationReport | null) ?? null,
    snapshotHash: (r.snapshot_hash as string | null) ?? null,
    createdAt: new Date(r.created_at as string).toISOString(),
    updatedAt: new Date(r.updated_at as string).toISOString(),
  };
}

/** Canonical form used for duplicate detection: roles + trimmed, whitespace-collapsed content. */
export function itemHash(rec: ChatRecord): string {
  const canonical = JSON.stringify(rec.messages.map((m) => ({ role: m.role, content: m.content.replace(/\s+/g, " ").trim() })));
  return createHash("sha256").update(canonical).digest("hex");
}

/**
 * Snapshot of exactly what a job will train on. The Python worker computes
 * the same digest (worker/omnix_trainer/dataset.py) and refuses to train if
 * the dataset changed after the job was created.
 */
export function snapshotHash(items: { item_hash: string; split: string }[]): string {
  const lines = items
    .map((i) => `${i.item_hash}:${i.split}`)
    .sort()
    .join("\n");
  return createHash("sha256").update(lines).digest("hex");
}

/** Deterministic split from the item's own hash: re-validation never reshuffles data between splits. */
export function assignSplit(hash: string, total: number): "train" | "validation" | "test" {
  const bucket = parseInt(hash.slice(0, 8), 16) % 100;
  if (total < 20) return bucket < 85 ? "train" : "validation";
  return bucket < 80 ? "train" : bucket < 90 ? "validation" : "test";
}

/** Structural validation of one chat record. Returns human-readable problems. */
export function structuralErrors(rec: unknown): string[] {
  const errors: string[] = [];
  const msgs = (rec as ChatRecord)?.messages;
  if (!Array.isArray(msgs) || msgs.length < 2) return ["needs a messages array with at least a user and an assistant turn"];
  let expect: "user" | "assistant" = "user";
  msgs.forEach((m, i) => {
    if (!m || typeof m.content !== "string" || !["system", "user", "assistant"].includes(m.role)) {
      errors.push(`message ${i + 1}: invalid role or content`);
      return;
    }
    if (!m.content.trim()) errors.push(`message ${i + 1}: empty content`);
    if (m.role === "system") {
      if (i !== 0) errors.push(`message ${i + 1}: system message must come first`);
      return;
    }
    if (m.role !== expect) errors.push(`message ${i + 1}: expected ${expect}, got ${m.role}`);
    expect = m.role === "user" ? "assistant" : "user";
  });
  if (msgs.at(-1)?.role !== "assistant") errors.push("the last message must be from the assistant (the target answer)");
  const tokens = msgs.reduce((n, m) => n + estimateTokens(String(m?.content ?? "")), 0);
  if (tokens > MAX_ITEM_TOKENS) errors.push(`too long (~${tokens} tokens, max ${MAX_ITEM_TOKENS})`);
  return errors;
}

/** Converts supported upload formats into chat records. */
export function parseDatasetFile(text: string): { records: ChatRecord[]; errors: { line: number; error: string }[] } {
  const records: ChatRecord[] = [];
  const errors: { line: number; error: string }[] = [];
  const trimmed = text.trim();
  let rows: { line: number; value: unknown }[];
  if (trimmed.startsWith("[")) {
    try {
      rows = (JSON.parse(trimmed) as unknown[]).map((value, i) => ({ line: i + 1, value }));
    } catch {
      return { records, errors: [{ line: 1, error: "invalid JSON array" }] };
    }
  } else {
    rows = [];
    trimmed.split(/\r?\n/).forEach((l, i) => {
      if (!l.trim()) return;
      try {
        rows.push({ line: i + 1, value: JSON.parse(l) });
      } catch {
        errors.push({ line: i + 1, error: "invalid JSON" });
      }
    });
  }
  for (const { line, value } of rows) {
    const v = value as Record<string, unknown>;
    if (Array.isArray(v?.messages)) {
      records.push({ messages: v.messages as ChatRecord["messages"] });
    } else if (typeof v?.prompt === "string" && typeof v?.completion === "string") {
      records.push({ messages: [{ role: "user", content: v.prompt }, { role: "assistant", content: v.completion }] });
    } else if (typeof v?.instruction === "string" && typeof v?.output === "string") {
      const input = typeof v.input === "string" && v.input.trim() ? `\n\n${v.input}` : "";
      records.push({ messages: [{ role: "user", content: `${v.instruction}${input}` }, { role: "assistant", content: v.output }] });
    } else {
      errors.push({ line, error: "expected {messages}, {prompt, completion} or {instruction, input, output}" });
    }
  }
  return { records, errors };
}

export async function getDataset(db: Db, id: string): Promise<Dataset> {
  const r = await db.query("SELECT * FROM ai_datasets WHERE id = $1", [id]);
  if (!r.rowCount) throw new AppError("NOT_FOUND", "Dataset not found");
  return datasetFromRow(r.rows[0]);
}

export async function addItems(
  db: Db,
  datasetId: string,
  records: ChatRecord[],
  source: "upload" | "manual" | "conversation",
  meta: { consent?: boolean; metadata?: Record<string, unknown> } = {},
): Promise<number> {
  const ds = await getDataset(db, datasetId);
  if (ds.status === "archived") throw new AppError("PRECONDITION_FAILED", "Dataset is archived");
  for (let i = 0; i < records.length; i += 200) {
    const batch = records.slice(i, i + 200);
    const values: unknown[] = [];
    const tuples = batch.map((rec) => {
      const b = values.length;
      values.push(datasetId, { messages: rec.messages }, itemHash(rec), source, meta.consent ?? false, meta.metadata ?? {});
      return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6})`;
    });
    await db.query(
      `INSERT INTO ai_dataset_items (dataset_id, content, item_hash, source, consent_recorded, metadata) VALUES ${tuples.join(", ")}`,
      values,
    );
  }
  // Any change invalidates the previous validation and snapshot.
  await db.query(
    `UPDATE ai_datasets SET record_count = (SELECT count(*) FROM ai_dataset_items WHERE dataset_id = $1),
            status = 'draft', snapshot_hash = NULL WHERE id = $1`,
    [datasetId],
  );
  return records.length;
}

/** Turns one assistant answer (and the question before it) into a training example — only with explicit consent. */
export async function addFromConversation(db: Db, ctx: ReqCtx, datasetId: string, assistantMessageId: string): Promise<void> {
  const a = await db.query("SELECT id, conversation_id, content, status FROM ai_messages WHERE id = $1 AND role = 'assistant'", [assistantMessageId]);
  if (!a.rowCount) throw new AppError("NOT_FOUND", "Message not found");
  if (a.rows[0].status !== "complete") throw new AppError("PRECONDITION_FAILED", "Only complete answers can become training data");
  const q = await db.query(
    `SELECT content FROM ai_messages WHERE conversation_id = $1 AND role = 'user'
        AND created_at <= (SELECT created_at FROM ai_messages WHERE id = $2) ORDER BY created_at DESC LIMIT 1`,
    [a.rows[0].conversation_id, assistantMessageId],
  );
  if (!q.rowCount) throw new AppError("NOT_FOUND", "No question found for this answer");
  await addItems(
    db,
    datasetId,
    [{ messages: [{ role: "user", content: q.rows[0].content }, { role: "assistant", content: a.rows[0].content }] }],
    "conversation",
    { consent: true, metadata: { messageId: assistantMessageId } },
  );
  await audit(db, ctx, "dataset.item_from_conversation", "dataset", datasetId, { messageId: assistantMessageId, consent: true });
}

export async function validateDataset(db: Db, ctx: ReqCtx, datasetId: string): Promise<Dataset> {
  const ds = await getDataset(db, datasetId);
  await db.query("UPDATE ai_datasets SET status = 'validating' WHERE id = $1", [datasetId]);
  const items = (await db.query<{ id: string; content: ChatRecord; item_hash: string }>(
    "SELECT id, content, item_hash FROM ai_dataset_items WHERE dataset_id = $1 ORDER BY created_at, id",
    [datasetId],
  )).rows;

  const seen = new Set<string>();
  const issues: ValidationReport["issues"] = [];
  const tokenCounts: number[] = [];
  let arabicChars = 0;
  let allChars = 0;
  const results: { id: string; status: string; errors: string[]; split: string | null; hash: string }[] = [];

  for (const it of items) {
    let status = "valid";
    let errors = structuralErrors(it.content);
    if (errors.length) status = "invalid";
    else if (seen.has(it.item_hash)) {
      status = "duplicate";
      errors = ["duplicate of an earlier item"];
    } else {
      const text = it.content.messages.map((m) => m.content).join("\n");
      const pii = detectPii(text);
      if (pii.length) {
        status = "pii_flagged";
        errors = [`contains personal or secret data: ${[...new Set(pii.map((p) => p.type))].join(", ")} — remove it before training`];
      }
    }
    seen.add(it.item_hash);
    if (status === "valid") {
      const text = it.content.messages.map((m) => m.content).join("\n");
      tokenCounts.push(estimateTokens(text));
      const ratio = arabicRatio(text);
      arabicChars += ratio * text.length;
      allChars += text.length;
    } else {
      issues.push({ itemId: it.id, status, errors });
    }
    results.push({ id: it.id, status, errors, split: null, hash: it.item_hash });
  }
  const validCount = results.filter((r) => r.status === "valid").length;
  for (const r of results) if (r.status === "valid") r.split = assignSplit(r.hash, validCount);

  if (results.length) {
    await db.query(
      `UPDATE ai_dataset_items i SET validation_status = v.status, validation_errors = v.errors, split = v.split
         FROM jsonb_to_recordset($2::jsonb) AS v(id uuid, status text, errors text[], split text)
        WHERE i.id = v.id AND i.dataset_id = $1`,
      [datasetId, JSON.stringify(results.map(({ id, status, errors, split }) => ({ id, status, errors, split })))],
    );
  }

  const valid = results.filter((r) => r.status === "valid").map((r) => ({ item_hash: r.hash, split: r.split! }));
  const splits = { train: 0, validation: 0, test: 0 };
  for (const v of valid) splits[v.split as keyof typeof splits]++;
  const sorted = [...tokenCounts].sort((a, b) => a - b);
  const blockers: string[] = [];
  if (validCount < MIN_VALID_ITEMS) blockers.push(`needs at least ${MIN_VALID_ITEMS} valid items (has ${validCount})`);
  if (splits.validation === 0 && validCount >= MIN_VALID_ITEMS) blockers.push("validation split is empty; add more items");
  if (!ds.rightsConfirmedAt) blockers.push("confirm you have the right to use this data for training");

  const report: ValidationReport = {
    validatedAt: new Date().toISOString(),
    total: results.length,
    valid: validCount,
    invalid: results.filter((r) => r.status === "invalid").length,
    duplicates: results.filter((r) => r.status === "duplicate").length,
    piiFlagged: results.filter((r) => r.status === "pii_flagged").length,
    splits,
    tokens: {
      min: sorted[0] ?? 0,
      median: sorted[Math.floor(sorted.length / 2)] ?? 0,
      max: sorted.at(-1) ?? 0,
      total: sorted.reduce((a, b) => a + b, 0),
    },
    arabicShare: allChars ? Number((arabicChars / allChars).toFixed(3)) : 0,
    issues: issues.slice(0, 200),
    readyForTraining: blockers.length === 0,
    blockers,
  };
  const status = validCount >= MIN_VALID_ITEMS && splits.validation > 0 ? "valid" : "invalid";
  const r = await db.query(
    `UPDATE ai_datasets SET status = $2, valid_count = $3, record_count = $4, last_validation = $5, snapshot_hash = $6
      WHERE id = $1 RETURNING *`,
    [datasetId, status, validCount, results.length, report, status === "valid" ? snapshotHash(valid) : null],
  );
  await audit(db, ctx, "dataset.validated", "dataset", datasetId, { valid: validCount, total: results.length, status });
  return datasetFromRow(r.rows[0]);
}
