import { knowledgeSearchSchema } from "@/lib/api/schemas";
import { hybridSearch } from "@/lib/ai/rag/retrieve";
import { withUser } from "@/lib/db/pool";
import { route } from "@/lib/http/route";

export const runtime = "nodejs";

/** Semantic, keyword or hybrid search over the workspace knowledge base, with sources. */
export const POST = route.auth(
  { scope: "knowledge:read", body: knowledgeSearchSchema, rateLimit: { name: "knowledge-search", limit: 120, windowSec: 60 } },
  async ({ auth, body }) =>
    withUser(auth.userId, async (db) => ({
      results: (await hybridSearch(db, { workspaceId: auth.workspaceId, query: body.query, topK: body.topK, mode: body.mode, tags: body.tags })).map((r) => ({
        documentId: r.documentId,
        title: r.documentTitle,
        filename: r.filename,
        chunkIndex: r.chunkIndex,
        page: r.page,
        heading: r.heading,
        content: r.content,
        similarity: r.similarity,
        keywordRank: r.keywordRank,
        score: r.score,
        relevant: r.relevant,
      })),
    })),
);
