import { compareVersions } from "@/lib/ai/eval/runner";
import { withUser } from "@/lib/db/pool";
import { parseId, route } from "@/lib/http/route";

export const runtime = "nodejs";

/** Base vs customised model: ?baseline=<versionId>&candidate=<versionId>. */
export const GET = route.auth({ sessionOnly: true }, async ({ auth, url }) => {
  const baseline = parseId(url.searchParams.get("baseline") ?? undefined, "Version");
  const candidate = parseId(url.searchParams.get("candidate") ?? undefined, "Version");
  return withUser(auth.userId, (db) => compareVersions(db, baseline, candidate));
});
