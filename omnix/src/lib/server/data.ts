import "server-only";
import { listProfiles, listVersions, type ModelVersion } from "@/lib/ai/models/service";
import type { ModelProfile } from "@/lib/ai/identity/model-config";
import { withUser } from "@/lib/db/pool";
import type { PageSession } from "./session";

export interface PrimaryModel {
  profile: ModelProfile;
  versions: ModelVersion[];
  deployed: ModelVersion | null;
}

/** The user's models in the current workspace; the first is the "primary" one shown across the UI. */
export async function loadModels(s: PageSession): Promise<PrimaryModel[]> {
  return withUser(s.auth.userId, async (db) => {
    const profiles = await listProfiles(db, s.auth.workspaceId);
    return Promise.all(
      profiles.map(async (profile) => {
        const versions = await listVersions(db, profile.id);
        return { profile, versions, deployed: versions.find((v) => v.status === "deployed") ?? null };
      }),
    );
  });
}

export async function loadPrimaryModel(s: PageSession, id?: string): Promise<PrimaryModel | null> {
  const all = await loadModels(s);
  return (id ? all.find((m) => m.profile.id === id) : undefined) ?? all[0] ?? null;
}
