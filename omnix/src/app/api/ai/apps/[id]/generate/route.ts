import { appGenerateSchema } from "@/lib/api/schemas";
import { getProject, runStudioTurn } from "@/lib/ai/studio/studio";
import { withUser } from "@/lib/db/pool";
import { parseId, route } from "@/lib/http/route";
import { sseResponse } from "@/lib/http/sse";

export const runtime = "nodejs";
export const maxDuration = 300; // the most a Vercel Hobby function may run; self-hosted servers ignore it

/**
 * Builds or changes the app with the owner's model, over Server-Sent Events:
 * meta → (delta | file | warning)* → done | error. A complete answer that
 * changed files becomes a new version; closing the connection stops it.
 */
export const POST = route.auth(
  { sessionOnly: true, body: appGenerateSchema, rateLimit: { name: "app-generate", limit: 30, windowSec: 600 } },
  async ({ auth, body, params, req, requestId, ip }) => {
    const projectId = parseId(params.id, "App");
    // Answer "not found" with a real 404 before the stream starts.
    await withUser(auth.userId, (db) => getProject(db, projectId));
    return sseResponse((signal) => runStudioTurn({ auth: { ...auth, requestId, ip }, projectId, message: body.message, signal }), {
      requestSignal: req.signal,
      requestId,
    });
  },
);
