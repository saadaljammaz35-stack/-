import { listProfiles, listVersions } from "@/lib/ai/models/service";
import { BASE_MODEL_CANDIDATES } from "@/lib/ai/models/catalog";
import { providerFromRow, syncPlatformProviders } from "@/lib/ai/providers/registry";
import { withUser } from "@/lib/db/pool";
import { route } from "@/lib/http/route";

export const runtime = "nodejs";

/** OMNIX Model Hub: the caller's personal models, the providers they can use, and the base-model catalog. */
export const GET = route.auth({ scope: "models:read" }, async ({ auth }) =>
  withUser(auth.userId, async (db) => {
    await syncPlatformProviders(db);
    const profiles = await listProfiles(db, auth.workspaceId);
    const personal = await Promise.all(
      profiles.map(async (p) => {
        const versions = await listVersions(db, p.id);
        const deployed = versions.find((v) => v.status === "deployed") ?? null;
        return {
          id: p.id, displayName: p.displayName, slug: p.slug, description: p.description, family: p.modelFamily,
          kind: "personal", deployedVersion: deployed?.version ?? null, latestVersion: versions[0]?.version ?? null,
          baseModel: (deployed ?? versions[0])?.baseModel ?? null, versionCount: versions.length,
        };
      }),
    );
    const providers = (await db.query("SELECT * FROM ai_model_providers ORDER BY owner_id NULLS FIRST, provider_name")).rows.map(providerFromRow);
    return {
      personal,
      providers: providers.map((p) => ({ id: p.id, name: p.providerName, type: p.providerType, scope: p.ownerId ? "personal" : "platform", status: p.status })),
      baseModels: BASE_MODEL_CANDIDATES,
    };
  }),
);
