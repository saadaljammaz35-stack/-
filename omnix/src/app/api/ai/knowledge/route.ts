import { listDocuments } from "@/lib/ai/rag/knowledge";
import { withUser } from "@/lib/db/pool";
import { route } from "@/lib/http/route";

export const runtime = "nodejs";

export const GET = route.auth({ scope: "knowledge:read" }, async ({ auth, url }) =>
  withUser(auth.userId, async (db) => ({
    documents: await listDocuments(db, auth.workspaceId, {
      search: url.searchParams.get("q")?.slice(0, 100) || undefined,
      tag: url.searchParams.get("tag")?.slice(0, 40) || undefined,
      category: url.searchParams.get("category")?.slice(0, 80) || undefined,
    }),
  })),
);
