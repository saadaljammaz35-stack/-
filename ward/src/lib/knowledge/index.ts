import { audit } from '@/lib/audit';
import { type OrgContext, type Queryable } from '@/lib/db';

export const KNOWLEDGE_CATEGORIES = [
  'identity', 'goals', 'decisions', 'episodes', 'guests', 'sponsorships',
  'marketing', 'meetings', 'files', 'budget', 'policies', 'reports',
] as const;
export type KnowledgeCategory = (typeof KNOWLEDGE_CATEGORIES)[number];

const DIACRITICS = /[ً-ٰٟۖ-ۭ]/g;
const PREFIXES = ['وال', 'بال', 'كال', 'فال', 'لل', 'ال'];
const STOPWORDS = new Set(['في', 'من', 'على', 'الى', 'عن', 'مع', 'هذا', 'هذه', 'ذلك', 'التي', 'الذي', 'او', 'ثم', 'كل', 'ما', 'لا', 'هل', 'the', 'and', 'or', 'of', 'to', 'in', 'a', 'an', 'is', 'for']);

/** Fold Arabic letter variants and strip diacritics/tatweel so search matches spelling variants. */
export function normalizeArabic(text: string): string {
  return text
    .normalize('NFKC')
    .replace(DIACRITICS, '')
    .replace(/ـ/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .toLowerCase();
}

function stem(word: string): string {
  for (const p of PREFIXES) {
    if (word.startsWith(p) && word.length - p.length >= 3) return word.slice(p.length);
  }
  return word;
}

export function searchTokens(text: string): string[] {
  return normalizeArabic(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w))
    .map(stem);
}

/** Text stored for full-text search: normalized and stemmed. */
export function searchText(text: string): string {
  return searchTokens(text).join(' ');
}

export function chunkText(text: string, size = 1200, overlap = 150): string[] {
  const clean = text.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();
  if (!clean) return [];
  if (clean.length <= size) return [clean];
  const paragraphs = clean.split(/\n\n+/);
  const chunks: string[] = [];
  let current = '';
  const flush = () => {
    if (current.trim()) chunks.push(current.trim());
    current = current.length > overlap ? current.slice(-overlap) : '';
  };
  for (const para of paragraphs) {
    if (para.length > size) {
      for (let i = 0; i < para.length; i += size - overlap) {
        if (current) flush();
        current = para.slice(i, i + size);
        flush();
      }
      continue;
    }
    if (current.length + para.length + 2 > size) flush();
    current += (current ? '\n\n' : '') + para;
  }
  if (current.trim() && chunks[chunks.length - 1] !== current.trim()) chunks.push(current.trim());
  return chunks;
}

export async function indexDocument(q: Queryable, orgId: string, documentId: string, content: string): Promise<number> {
  await q.query('delete from ward.knowledge_chunks where document_id = $1', [documentId]);
  const chunks = chunkText(content);
  for (const [ord, chunk] of chunks.entries()) {
    await q.query(
      `insert into ward.knowledge_chunks (org_id, document_id, ord, content, search_text) values ($1,$2,$3,$4,$5)`,
      [orgId, documentId, ord, chunk, searchText(chunk)],
    );
  }
  return chunks.length;
}

export interface NewDocument {
  title: string;
  category: KnowledgeCategory;
  content: string;
  source?: 'manual' | 'upload' | 'system' | 'agent';
  fileId?: string | null;
  verified?: boolean;
}

export async function createDocument(q: Queryable, ctx: OrgContext, doc: NewDocument, agentId?: string | null): Promise<string> {
  const rows = await q.query<{ id: string }>(
    `insert into ward.knowledge_documents (org_id, title, category, source, content, file_id, verified, created_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
    [ctx.orgId, doc.title.slice(0, 300), doc.category, doc.source ?? 'manual', doc.content, doc.fileId ?? null, doc.verified ?? false, ctx.userId],
  );
  const id = rows[0]!.id;
  await indexDocument(q, ctx.orgId, id, `${doc.title}\n\n${doc.content}`);
  await audit(q, ctx, 'knowledge.created', { type: 'knowledge_document', id }, { title: doc.title, category: doc.category, source: doc.source ?? 'manual' }, agentId);
  return id;
}

export async function updateDocument(
  q: Queryable,
  ctx: OrgContext,
  id: string,
  patch: Partial<Pick<NewDocument, 'title' | 'category' | 'content' | 'verified'>> & { status?: 'active' | 'archived' },
): Promise<boolean> {
  const rows = await q.query<{ title: string; content: string }>(
    `update ward.knowledge_documents set
        title = coalesce($2, title), category = coalesce($3, category), content = coalesce($4, content),
        verified = coalesce($5, verified), status = coalesce($6, status)
      where id = $1 returning title, content`,
    [id, patch.title ?? null, patch.category ?? null, patch.content ?? null, patch.verified ?? null, patch.status ?? null],
  );
  const row = rows[0];
  if (!row) return false;
  if (patch.title !== undefined || patch.content !== undefined) await indexDocument(q, ctx.orgId, id, `${row.title}\n\n${row.content}`);
  await audit(q, ctx, 'knowledge.updated', { type: 'knowledge_document', id }, { fields: Object.keys(patch) });
  return true;
}

export async function deleteDocument(q: Queryable, ctx: OrgContext, id: string): Promise<boolean> {
  const rows = await q.query<{ title: string }>('delete from ward.knowledge_documents where id = $1 returning title', [id]);
  if (rows[0]) await audit(q, ctx, 'knowledge.deleted', { type: 'knowledge_document', id }, { title: rows[0].title });
  return rows.length > 0;
}

export interface Hit {
  chunkId: string;
  documentId: string;
  title: string;
  category: string;
  source: string;
  verified: boolean;
  content: string;
  score: number;
}

/**
 * Retrieval for RAG: OR-query over normalized tokens with prefix matching, ranked by
 * cover density; founder-verified documents get a boost. Runs inside the org's RLS scope.
 */
export async function searchKnowledge(q: Queryable, query: string, limit = 6, category?: KnowledgeCategory): Promise<Hit[]> {
  const terms = [...new Set(searchTokens(query))]
    .map((t) => t.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter((t) => t.length >= 2)
    .slice(0, 12)
    .map((t) => `${t}:*`);
  if (terms.length === 0) return [];
  // Ranking: how many DISTINCT query terms a chunk covers comes first (a short, precise
  // passage beats a long one that repeats a single word), then length-normalized cover
  // density, then a small boost for founder-verified documents.
  const FIRST_TERM_PARAM = 4; // $1..$3 are the OR-query, limit and category
  const coverage = terms.map((_, i) => `(c.tsv @@ to_tsquery('simple', $${FIRST_TERM_PARAM + i}))::int`).join(' + ');
  const rows = await q.query<{
    chunk_id: string; document_id: string; title: string; category: string; source: string; verified: boolean; content: string; score: number;
  }>(
    `select c.id as chunk_id, d.id as document_id, d.title, d.category, d.source, d.verified, c.content,
            ((${coverage}) + ts_rank_cd(c.tsv, to_tsquery('simple', $1), 1) + case when d.verified then 0.25 else 0 end)::float8 as score
       from ward.knowledge_chunks c
       join ward.knowledge_documents d on d.id = c.document_id
      where d.status = 'active' and c.tsv @@ to_tsquery('simple', $1) and ($3::text is null or d.category = $3)
      order by score desc
      limit $2`,
    [terms.join(' | '), Math.min(Math.max(limit, 1), 20), category ?? null, ...terms],
  );
  return rows.map((r) => ({
    chunkId: r.chunk_id, documentId: r.document_id, title: r.title, category: r.category,
    source: r.source, verified: r.verified, content: r.content, score: Number(r.score),
  }));
}
