import { getProject, getVersionFiles, previewUrl } from "@/lib/ai/studio/studio";
import { withUser } from "@/lib/db/pool";
import { parseId, route } from "@/lib/http/route";

export const runtime = "nodejs";

export const GET = route.auth({ sessionOnly: true }, async ({ auth, params }) => {
  const id = parseId(params.id, "App");
  const versionId = parseId(params.versionId, "Version");
  return withUser(auth.userId, async (db) => {
    await getProject(db, id);
    const files = await getVersionFiles(db, id, versionId);
    return { versionId, files, previewUrl: previewUrl(auth.userId, versionId, files) };
  });
});
