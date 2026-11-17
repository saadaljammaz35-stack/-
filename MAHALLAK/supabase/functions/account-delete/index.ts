import { adminClient, requireUser } from '../_shared/auth.ts';
import { HttpError, handler, json, readJson } from '../_shared/http.ts';

const BUCKETS = ['item-images', 'location-images'];

/**
 * Permanently deletes the caller's account: every photo in the private buckets,
 * then the auth user (all table rows cascade from auth.users).
 */
Deno.serve(
  handler(async (req) => {
    const user = await requireUser(req);
    const body = await readJson<{ confirm?: string }>(req, 1024);
    if (body.confirm !== 'DELETE') throw new HttpError(400, 'confirmation_required');
    const admin = adminClient();
    let removed = 0;
    for (const bucket of BUCKETS) {
      for (;;) {
        const { data, error } = await admin.storage.from(bucket).list(user.id, { limit: 1000 });
        if (error) throw new HttpError(500, 'storage_unavailable');
        if (!data || data.length === 0) break;
        const paths = data.map((f) => `${user.id}/${f.name}`);
        const { error: delErr } = await admin.storage.from(bucket).remove(paths);
        if (delErr) throw new HttpError(500, 'storage_delete_failed');
        removed += paths.length;
        if (data.length < 1000) break;
      }
    }
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw new HttpError(500, 'delete_failed');
    return json({ deleted: true, photos_removed: removed });
  }),
);
