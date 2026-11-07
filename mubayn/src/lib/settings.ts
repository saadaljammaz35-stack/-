import { z } from "zod";
import { audit } from "./audit";
import { one, query } from "./db";

export const limitsSchema = z.object({
  maxImages: z.number().int().min(4).max(40),
  maxVideos: z.number().int().min(0).max(3),
  maxVideoSeconds: z.number().int().min(5).max(180),
  // 0 = no per-user monthly limit (fully free). Pause submissions with submissionsOpen.
  monthlyInspectionsPerUser: z.number().int().min(0).max(1000),
  dailyAnalysesGlobal: z.number().int().min(0).max(100000),
  signupsOpen: z.boolean(),
  submissionsOpen: z.boolean(),
});
export type Limits = z.infer<typeof limitsSchema>;

const DEFAULTS: Limits = {
  maxImages: 20,
  maxVideos: 1,
  maxVideoSeconds: 60,
  monthlyInspectionsPerUser: 3,
  dailyAnalysesGlobal: 50,
  signupsOpen: true,
  submissionsOpen: true,
};

export async function getLimits(): Promise<Limits> {
  const row = await one<{ value: unknown }>(`SELECT value FROM settings WHERE key = 'limits'`);
  const parsed = limitsSchema.safeParse({ ...DEFAULTS, ...((row?.value as object) ?? {}) });
  return parsed.success ? parsed.data : DEFAULTS;
}

export async function updateLimits(adminId: string, next: Limits): Promise<void> {
  const before = await getLimits();
  await query(
    `INSERT INTO settings (key, value, updated_by, updated_at) VALUES ('limits', $1, $2, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
    [JSON.stringify(next), adminId],
  );
  await audit(adminId, "settings.limits_updated", { type: "settings", id: "limits" }, { before, after: next });
}
