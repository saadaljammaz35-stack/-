import type { SupabaseClient } from '@supabase/supabase-js';

import type { ImageRef, Item, Place, PlacementEvent, VoiceSearchLog } from '@/domain/models';
import type { DocumentStore, Row } from '@/data/types';
import { nowIso } from '@/lib/clock';
import type { OutboxEntry } from '@/services/itemService';

/**
 * Optional cloud backup. Local data is the source of truth on the device; this
 * service replays the outbox to Supabase (protected by Row Level Security) and
 * pulls changes from the user's other devices. Photos are uploaded only when the
 * user explicitly enabled photo backup.
 */

export interface SyncOptions {
  cloudPhotos: boolean;
}

export interface SyncDeps {
  store: DocumentStore;
  client: SupabaseClient;
  userId: string;
  options: () => SyncOptions;
  /** Reads a local file for upload. Injected so the service stays testable. */
  readBytes: (uri: string) => Promise<ArrayBuffer>;
}

export interface SyncReport {
  pushed: number;
  failed: number;
  pulled: number;
  photosUploaded: number;
  errors: string[];
}

const ORDER: OutboxEntry['table'][] = ['images', 'places', 'items', 'placements', 'search_logs'];
export const BUCKETS = { item: 'item-images', location: 'location-images' } as const;

// ------------------------------------------------------------------ mapping
export const toRemote = {
  item: (i: Item, userId: string) => ({
    id: i.id,
    user_id: userId,
    name: i.name,
    name_en: i.nameEn,
    category_id: i.category,
    color: i.color,
    keywords: i.keywords,
    tags: i.tags,
    notes: i.notes,
    favorite: i.favorite,
    original_image_id: i.originalImageId,
    cutout_image_id: i.cutoutImageId,
    current_location_id: i.currentLocationId,
    source: i.source,
    created_at: i.createdAt,
    updated_at: i.updatedAt,
    last_moved_at: i.lastMovedAt,
    deleted_at: i.deletedAt,
  }),
  place: (p: Place, userId: string) => ({
    id: p.id,
    user_id: userId,
    room: p.room,
    room_label: p.roomLabel,
    spot: p.spot,
    note: p.note,
    image_id: p.imageId,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
    deleted_at: p.deletedAt,
  }),
  placement: (e: PlacementEvent, userId: string) => ({
    id: e.id,
    user_id: userId,
    item_id: e.itemId,
    location_id: e.placeId,
    room: e.room,
    room_label: e.roomLabel,
    spot: e.spot,
    note: e.note,
    image_id: e.imageId,
    placed_at: e.placedAt,
    created_at: e.createdAt,
  }),
  image: (img: ImageRef, userId: string) => ({
    id: img.id,
    user_id: userId,
    kind: img.kind,
    storage_path: img.remotePath,
    width: img.width,
    height: img.height,
    created_at: img.createdAt,
  }),
  log: (l: VoiceSearchLog, userId: string) => ({
    id: l.id,
    user_id: userId,
    transcript: l.transcript,
    intent: l.intent,
    confidence: l.confidence,
    dialect_hints: l.dialectHints,
    result_count: l.resultCount,
    source: l.source,
    created_at: l.createdAt,
  }),
};

type R = Record<string, unknown>;
const s = (v: unknown) => (v == null ? null : String(v));

export const fromRemote = {
  item: (r: R): Item => ({
    id: String(r.id),
    name: String(r.name),
    nameEn: s(r.name_en),
    category: r.category_id as Item['category'],
    color: (r.color as Item['color']) ?? null,
    keywords: (r.keywords as string[]) ?? [],
    tags: (r.tags as string[]) ?? [],
    notes: s(r.notes),
    favorite: Boolean(r.favorite),
    originalImageId: s(r.original_image_id),
    cutoutImageId: s(r.cutout_image_id),
    currentLocationId: s(r.current_location_id),
    source: (r.source as Item['source']) ?? 'manual',
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
    lastMovedAt: s(r.last_moved_at),
    deletedAt: s(r.deleted_at),
  }),
  place: (r: R): Place => ({
    id: String(r.id),
    room: r.room as Place['room'],
    roomLabel: s(r.room_label),
    spot: String(r.spot),
    note: s(r.note),
    imageId: s(r.image_id),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
    deletedAt: s(r.deleted_at),
  }),
  placement: (r: R): PlacementEvent => ({
    id: String(r.id),
    itemId: String(r.item_id),
    placeId: String(r.location_id),
    room: r.room as PlacementEvent['room'],
    roomLabel: s(r.room_label),
    spot: String(r.spot),
    note: s(r.note),
    imageId: s(r.image_id),
    placedAt: String(r.placed_at),
    createdAt: String(r.created_at),
  }),
  image: (r: R, local: ImageRef | null): ImageRef => ({
    id: String(r.id),
    kind: r.kind as ImageRef['kind'],
    localUri: local?.localUri ?? null,
    remotePath: s(r.storage_path),
    width: Number(r.width ?? 0),
    height: Number(r.height ?? 0),
    createdAt: String(r.created_at),
  }),
};

const imageTable = (kind: ImageRef['kind']) => (kind === 'location' ? 'location_images' : 'item_images');
const bucketFor = (kind: ImageRef['kind']) => (kind === 'location' ? BUCKETS.location : BUCKETS.item);

export class SyncService {
  constructor(private deps: SyncDeps) {}

  async syncNow(): Promise<SyncReport> {
    const report: SyncReport = { pushed: 0, failed: 0, pulled: 0, photosUploaded: 0, errors: [] };
    await this.push(report);
    await this.pull(report);
    return report;
  }

  async push(report: SyncReport): Promise<void> {
    const { store } = this.deps;
    const entries = (await store.all<OutboxEntry>('outbox')).sort(
      (a, b) => ORDER.indexOf(a.table) - ORDER.indexOf(b.table) || a.createdAt.localeCompare(b.createdAt),
    );
    for (const entry of entries) {
      try {
        await this.pushOne(entry, report);
        await store.remove('outbox', entry.id);
        report.pushed++;
      } catch (e) {
        report.failed++;
        report.errors.push(`${entry.table}:${entry.rowId}: ${(e as Error).message}`);
        await store.put('outbox', { ...entry, attempts: entry.attempts + 1 });
      }
    }
  }

  private async pushOne(entry: OutboxEntry, report: SyncReport): Promise<void> {
    const { store, client, userId } = this.deps;
    const check = (res: { error: { message: string } | null }) => {
      if (res.error) throw new Error(res.error.message);
    };
    switch (entry.table) {
      case 'images': {
        const img = await store.get<ImageRef>('images', entry.rowId);
        if (!img) return;
        let current = img;
        if (this.deps.options().cloudPhotos && img.localUri && !img.remotePath) {
          const ext = img.kind === 'item_cutout' ? 'png' : 'jpg';
          const path = `${userId}/${img.id}.${ext}`;
          const body = await this.deps.readBytes(img.localUri);
          const up = await client.storage
            .from(bucketFor(img.kind))
            .upload(path, body, { contentType: ext === 'png' ? 'image/png' : 'image/jpeg', upsert: true });
          check(up);
          current = { ...img, remotePath: path };
          await store.put('images', current);
          report.photosUploaded++;
        }
        check(await client.from(imageTable(img.kind)).upsert(toRemote.image(current, userId)));
        return;
      }
      case 'places': {
        const p = await store.get<Place>('places', entry.rowId);
        if (p) check(await client.from('locations').upsert(toRemote.place(p, userId)));
        return;
      }
      case 'items': {
        const i = await store.get<Item>('items', entry.rowId);
        if (i) check(await client.from('items').upsert(toRemote.item(i, userId)));
        return;
      }
      case 'placements': {
        const e = await store.get<PlacementEvent>('placements', entry.rowId);
        // History is append-only on the server (no UPDATE privilege): insert, ignoring rows already there.
        if (e) check(await client.from('item_location_history').upsert(toRemote.placement(e, userId), { onConflict: 'id', ignoreDuplicates: true }));
        return;
      }
      case 'search_logs': {
        if (entry.op === 'delete') {
          check(await client.from('voice_search_history').delete().eq('id', entry.rowId));
          return;
        }
        const l = await store.get<VoiceSearchLog>('search_logs', entry.rowId);
        if (l) check(await client.from('voice_search_history').upsert(toRemote.log(l, userId)));
        return;
      }
    }
  }

  async pull(report: SyncReport): Promise<void> {
    const { store, client } = this.deps;
    const cursorRow = await store.get<Row & { value: Record<string, string> }>('kv', 'sync_cursor');
    const cursor = cursorRow?.value ?? {};
    const since = (k: string) => cursor[k] ?? '1970-01-01T00:00:00.000Z';
    const next: Record<string, string> = { ...cursor };
    const pending = new Set((await store.all<OutboxEntry>('outbox')).map((o) => `${o.table}:${o.rowId}`));

    const fetchSince = async (table: string, column: string) => {
      const res = await client.from(table).select('*').gt(column, since(table)).order(column, { ascending: true }).limit(1000);
      if (res.error) throw new Error(res.error.message);
      const rows = (res.data ?? []) as R[];
      if (rows.length) next[table] = String(rows[rows.length - 1][column]);
      return rows;
    };

    try {
      for (const table of ['item_images', 'location_images'] as const) {
        for (const r of await fetchSince(table, 'created_at')) {
          const local = await store.get<ImageRef>('images', String(r.id));
          await store.put('images', fromRemote.image(r, local));
          report.pulled++;
        }
      }
      for (const r of await fetchSince('locations', 'updated_at')) {
        const remote = fromRemote.place(r);
        const local = await store.get<Place>('places', remote.id);
        if (!pending.has(`places:${remote.id}`) && (!local || local.updatedAt < remote.updatedAt)) {
          await store.put('places', remote);
          report.pulled++;
        }
      }
      for (const r of await fetchSince('items', 'updated_at')) {
        const remote = fromRemote.item(r);
        const local = await store.get<Item>('items', remote.id);
        // last write wins, but never overwrite a local change that is still waiting to upload
        if (!pending.has(`items:${remote.id}`) && (!local || local.updatedAt < remote.updatedAt)) {
          await store.put('items', remote);
          report.pulled++;
        }
      }
      for (const r of await fetchSince('item_location_history', 'created_at')) {
        await store.put('placements', fromRemote.placement(r));
        report.pulled++;
      }
      await store.put('kv', { id: 'sync_cursor', value: next, updatedAt: nowIso() });
    } catch (e) {
      report.errors.push(`pull: ${(e as Error).message}`);
    }
  }
}
