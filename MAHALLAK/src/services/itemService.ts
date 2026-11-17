import { isCategoryId, isColorId, isRoomId, type CategoryId, type ColorId, type RoomId } from '@/domain/categories';
import type { ImageRef, Item, ItemWithPlace, Place, PlacementEvent, VoiceSearchLog } from '@/domain/models';
import type { DocumentStore, TableName } from '@/data/types';
import { nowIso } from '@/lib/clock';
import { newId } from '@/lib/id';

export interface OutboxEntry {
  id: string;
  table: Exclude<TableName, 'outbox' | 'kv'>;
  rowId: string;
  op: 'upsert' | 'delete';
  createdAt: string;
  attempts: number;
}

export interface NewPlaceInput {
  room: RoomId;
  roomLabel?: string | null;
  spot: string;
  note?: string | null;
  imageId?: string | null;
}

export interface PlacementInput {
  /** Reuse a place the user already registered... */
  placeId?: string;
  /** ...or describe a new one. */
  newPlace?: NewPlaceInput;
}

export interface NewItemInput {
  name: string;
  nameEn?: string | null;
  category: CategoryId;
  color?: ColorId | null;
  keywords?: string[];
  tags?: string[];
  notes?: string | null;
  originalImageId?: string | null;
  cutoutImageId?: string | null;
  source?: Item['source'];
}

export class ValidationError extends Error {
  constructor(public field: string, message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

const clean = (s: string | null | undefined, max: number) => {
  const v = (s ?? '').replace(/\s+/g, ' ').trim();
  return v.length > max ? v.slice(0, max) : v;
};
const cleanList = (list: string[] | undefined, maxItems: number, maxLen: number) =>
  [...new Set((list ?? []).map((x) => clean(x, maxLen)).filter(Boolean))].slice(0, maxItems);

/**
 * All writes go through here: validated, stored locally first, and queued in the
 * outbox so cloud sync (when enabled) can replay them.
 */
export class ItemService {
  constructor(
    private store: DocumentStore,
    private onChange: () => void = () => {},
  ) {}

  // ------------------------------------------------------------------ reads
  async listItems(): Promise<Item[]> {
    const items = await this.store.all<Item>('items');
    return items.filter((i) => !i.deletedAt).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  }

  async getItem(id: string): Promise<Item | null> {
    const item = await this.store.get<Item>('items', id);
    return item && !item.deletedAt ? item : null;
  }

  async listPlaces(): Promise<Place[]> {
    return (await this.store.all<Place>('places')).filter((p) => !p.deletedAt);
  }

  async getPlace(id: string): Promise<Place | null> {
    return this.store.get<Place>('places', id);
  }

  async getImage(id: string | null | undefined): Promise<ImageRef | null> {
    return id ? this.store.get<ImageRef>('images', id) : null;
  }

  async getItemWithPlace(id: string): Promise<ItemWithPlace | null> {
    const item = await this.getItem(id);
    if (!item) return null;
    const place = item.currentLocationId ? await this.getPlace(item.currentLocationId) : null;
    return {
      item,
      place,
      image: await this.getImage(item.cutoutImageId ?? item.originalImageId),
      placeImage: await this.getImage(place?.imageId),
    };
  }

  /** Placement history, newest first. Snapshots stay accurate even if the place is edited later. */
  async history(itemId: string): Promise<PlacementEvent[]> {
    const all = await this.store.all<PlacementEvent>('placements');
    return all.filter((p) => p.itemId === itemId).sort((a, b) => Date.parse(b.placedAt) - Date.parse(a.placedAt));
  }

  // ------------------------------------------------------------------ writes
  async saveImage(input: Omit<ImageRef, 'id' | 'createdAt'> & { id?: string }): Promise<ImageRef> {
    const ref: ImageRef = { ...input, id: input.id ?? newId(), createdAt: nowIso() };
    await this.store.transaction(async () => {
      await this.store.put('images', ref);
      await this.enqueue('images', ref.id, 'upsert');
    });
    return ref;
  }

  async createPlace(input: NewPlaceInput): Promise<Place> {
    const place = this.buildPlace(input);
    await this.store.transaction(async () => {
      await this.store.put('places', place);
      await this.enqueue('places', place.id, 'upsert');
    });
    this.onChange();
    return place;
  }

  async updatePlace(id: string, patch: Partial<NewPlaceInput>): Promise<Place> {
    const place = await this.getPlace(id);
    if (!place) throw new ValidationError('place', 'place_not_found');
    const next: Place = {
      ...place,
      room: patch.room && isRoomId(patch.room) ? patch.room : place.room,
      roomLabel: patch.roomLabel !== undefined ? clean(patch.roomLabel, 60) || null : place.roomLabel,
      spot: patch.spot !== undefined ? clean(patch.spot, 200) : place.spot,
      note: patch.note !== undefined ? clean(patch.note, 300) || null : place.note,
      imageId: patch.imageId !== undefined ? patch.imageId : place.imageId,
      updatedAt: nowIso(),
    };
    if (!next.spot) throw new ValidationError('spot', 'spot_required');
    await this.store.transaction(async () => {
      await this.store.put('places', next);
      await this.enqueue('places', next.id, 'upsert');
    });
    this.onChange();
    return next;
  }

  async createItem(input: NewItemInput, placement: PlacementInput): Promise<Item> {
    const name = clean(input.name, 120);
    if (!name) throw new ValidationError('name', 'name_required');
    if (!isCategoryId(input.category)) throw new ValidationError('category', 'invalid_category');
    if (input.color && !isColorId(input.color)) throw new ValidationError('color', 'invalid_color');
    const ts = nowIso();
    const item: Item = {
      id: newId(),
      name,
      nameEn: clean(input.nameEn, 120) || null,
      category: input.category,
      color: input.color ?? null,
      keywords: cleanList(input.keywords, 20, 60),
      tags: cleanList(input.tags, 10, 40),
      notes: clean(input.notes, 500) || null,
      favorite: false,
      originalImageId: input.originalImageId ?? null,
      cutoutImageId: input.cutoutImageId ?? null,
      currentLocationId: null,
      source: input.source ?? 'manual',
      createdAt: ts,
      updatedAt: ts,
      lastMovedAt: null,
      deletedAt: null,
    };
    await this.store.transaction(async () => {
      const place = await this.resolvePlace(placement);
      const event = this.buildEvent(item.id, place, ts);
      item.currentLocationId = place.id;
      item.lastMovedAt = ts;
      await this.store.put('items', item);
      await this.store.put('placements', event);
      await this.enqueue('items', item.id, 'upsert');
      await this.enqueue('placements', event.id, 'upsert');
    });
    this.onChange();
    return item;
  }

  /** Records that the item now lives somewhere else. The previous place stays in history. */
  async moveItem(itemId: string, placement: PlacementInput): Promise<PlacementEvent> {
    const item = await this.getItem(itemId);
    if (!item) throw new ValidationError('item', 'item_not_found');
    const ts = nowIso();
    let event!: PlacementEvent;
    await this.store.transaction(async () => {
      const place = await this.resolvePlace(placement);
      event = this.buildEvent(item.id, place, ts);
      const next: Item = { ...item, currentLocationId: place.id, lastMovedAt: ts, updatedAt: ts };
      await this.store.put('items', next);
      await this.store.put('placements', event);
      await this.enqueue('items', item.id, 'upsert');
      await this.enqueue('placements', event.id, 'upsert');
    });
    this.onChange();
    return event;
  }

  async updateItem(id: string, patch: Partial<NewItemInput>): Promise<Item> {
    const item = await this.getItem(id);
    if (!item) throw new ValidationError('item', 'item_not_found');
    const next: Item = { ...item, updatedAt: nowIso() };
    if (patch.name !== undefined) {
      next.name = clean(patch.name, 120);
      if (!next.name) throw new ValidationError('name', 'name_required');
    }
    if (patch.nameEn !== undefined) next.nameEn = clean(patch.nameEn, 120) || null;
    if (patch.category !== undefined) {
      if (!isCategoryId(patch.category)) throw new ValidationError('category', 'invalid_category');
      next.category = patch.category;
    }
    if (patch.color !== undefined) {
      if (patch.color && !isColorId(patch.color)) throw new ValidationError('color', 'invalid_color');
      next.color = patch.color ?? null;
    }
    if (patch.keywords) next.keywords = cleanList(patch.keywords, 20, 60);
    if (patch.tags) next.tags = cleanList(patch.tags, 10, 40);
    if (patch.notes !== undefined) next.notes = clean(patch.notes, 500) || null;
    if (patch.originalImageId !== undefined) next.originalImageId = patch.originalImageId;
    if (patch.cutoutImageId !== undefined) next.cutoutImageId = patch.cutoutImageId;
    await this.store.transaction(async () => {
      await this.store.put('items', next);
      await this.enqueue('items', id, 'upsert');
    });
    this.onChange();
    return next;
  }

  async setFavorite(id: string, favorite: boolean): Promise<void> {
    const item = await this.getItem(id);
    if (!item) return;
    await this.store.transaction(async () => {
      await this.store.put('items', { ...item, favorite, updatedAt: nowIso() });
      await this.enqueue('items', id, 'upsert');
    });
    this.onChange();
  }

  /** Soft delete: hidden immediately, tombstone synced so other devices remove it too. */
  async deleteItem(id: string): Promise<void> {
    const item = await this.store.get<Item>('items', id);
    if (!item) return;
    const ts = nowIso();
    await this.store.transaction(async () => {
      await this.store.put('items', { ...item, deletedAt: ts, updatedAt: ts });
      await this.enqueue('items', id, 'delete');
    });
    this.onChange();
  }

  async logSearch(entry: Omit<VoiceSearchLog, 'id' | 'createdAt'>, keepHistory: boolean): Promise<void> {
    if (!keepHistory) return;
    const log: VoiceSearchLog = { ...entry, transcript: clean(entry.transcript, 300), id: newId(), createdAt: nowIso() };
    await this.store.put('search_logs', log);
    await this.enqueue('search_logs', log.id, 'upsert');
  }

  async searchLogs(): Promise<VoiceSearchLog[]> {
    const logs = await this.store.all<VoiceSearchLog>('search_logs');
    return logs.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }

  async clearSearchLogs(): Promise<void> {
    for (const l of await this.store.all<VoiceSearchLog>('search_logs')) {
      await this.store.remove('search_logs', l.id);
      await this.enqueue('search_logs', l.id, 'delete');
    }
  }

  async pendingOutbox(): Promise<OutboxEntry[]> {
    const entries = await this.store.all<OutboxEntry>('outbox');
    return entries.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async ackOutbox(ids: string[]): Promise<void> {
    for (const id of ids) await this.store.remove('outbox', id);
  }

  /** Everything the user owns, as portable JSON (Settings → Export my data). */
  async exportAll(): Promise<Record<string, unknown>> {
    return {
      format: 'mahallak-export',
      version: 1,
      exportedAt: nowIso(),
      items: await this.store.all('items'),
      places: await this.store.all('places'),
      placements: await this.store.all('placements'),
      images: (await this.store.all<ImageRef>('images')).map(({ localUri: _l, ...rest }) => rest),
      searchHistory: await this.store.all('search_logs'),
    };
  }

  /** Removes every local record (used after account deletion or "erase this device"). */
  async wipeLocal(): Promise<void> {
    await this.store.clear();
    this.onChange();
  }

  // ------------------------------------------------------------------ internals
  private buildPlace(input: NewPlaceInput): Place {
    if (!isRoomId(input.room)) throw new ValidationError('room', 'invalid_room');
    const spot = clean(input.spot, 200);
    if (!spot) throw new ValidationError('spot', 'spot_required');
    const ts = nowIso();
    return {
      id: newId(),
      room: input.room,
      roomLabel: clean(input.roomLabel, 60) || null,
      spot,
      note: clean(input.note, 300) || null,
      imageId: input.imageId ?? null,
      createdAt: ts,
      updatedAt: ts,
      deletedAt: null,
    };
  }

  private async resolvePlace(placement: PlacementInput): Promise<Place> {
    if (placement.placeId) {
      const existing = await this.getPlace(placement.placeId);
      if (!existing || existing.deletedAt) throw new ValidationError('place', 'place_not_found');
      return existing;
    }
    if (!placement.newPlace) throw new ValidationError('place', 'place_required');
    const place = this.buildPlace(placement.newPlace);
    await this.store.put('places', place);
    await this.enqueue('places', place.id, 'upsert');
    return place;
  }

  private buildEvent(itemId: string, place: Place, ts: string): PlacementEvent {
    return {
      id: newId(),
      itemId,
      placeId: place.id,
      room: place.room,
      roomLabel: place.roomLabel,
      spot: place.spot,
      note: place.note,
      imageId: place.imageId,
      placedAt: ts,
      createdAt: ts,
    };
  }

  private async enqueue(table: OutboxEntry['table'], rowId: string, op: OutboxEntry['op']): Promise<void> {
    const entry: OutboxEntry = { id: `${table}:${rowId}`, table, rowId, op, createdAt: nowIso(), attempts: 0 };
    await this.store.put('outbox', entry);
  }
}
