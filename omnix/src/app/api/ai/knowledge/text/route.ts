import { knowledgeTextSchema } from "@/lib/api/schemas";
import { createTextDocument, processDocument } from "@/lib/ai/rag/knowledge";
import { json, route } from "@/lib/http/route";
import { runInBackground } from "@/lib/jobs/background";

export const runtime = "nodejs";

/** Add knowledge by typing or pasting text. */
export const POST = route.auth(
  { scope: "knowledge:write", body: knowledgeTextSchema, maxBodyBytes: 2 * 1024 * 1024 },
  async ({ auth, body, requestId, ip }) => {
    const doc = await createTextDocument({ ...auth, requestId, ip }, body);
    await runInBackground("knowledge.process", () => processDocument(auth.userId, doc.id));
    return json({ document: doc }, { status: 201 });
  },
);
