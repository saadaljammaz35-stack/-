import { adminClient, requireUser } from '../_shared/auth.ts';
import { handler, json } from '../_shared/http.ts';

const TABLES = ['users', 'user_settings', 'items', 'locations', 'item_location_history', 'item_images', 'location_images', 'voice_search_history', 'entitlements', 'ai_usage'] as const;

/** Everything stored for the caller, plus 24h signed links to their photos. */
Deno.serve(
  handler(async (req) => {
    const user = await requireUser(req);
    const admin = adminClient();
    const out: Record<string, unknown> = { format: 'mahallak-cloud-export', version: 1, exported_at: new Date().toISOString(), user_id: user.id };
    for (const t of TABLES) {
      const col = t === 'users' ? 'id' : 'user_id';
      const { data } = await admin.from(t).select('*').eq(col, user.id);
      out[t] = data ?? [];
    }
    const links: Record<string, string> = {};
    for (const [table, bucket] of [['item_images', 'item-images'], ['location_images', 'location-images']] as const) {
      for (const row of (out[table] as Array<{ id: string; storage_path: string | null }>) ?? []) {
        if (!row.storage_path) continue;
        const { data } = await admin.storage.from(bucket).createSignedUrl(row.storage_path, 86400);
        if (data?.signedUrl) links[row.id] = data.signedUrl;
      }
    }
    out.photo_links = links;
    return json(out);
  }),
);
