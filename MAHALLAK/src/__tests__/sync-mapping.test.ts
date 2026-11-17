import type { Item, Place, PlacementEvent } from '@/domain/models';
import { fromRemote, toRemote } from '@/services/sync/syncService';

const ts = '2026-11-17T10:00:00.000Z';

describe('sync field mapping (device <-> server)', () => {
  it('round-trips an item without losing fields', () => {
    const item: Item = {
      id: 'i1', name: 'سماعة AirPods', nameEn: 'AirPods', category: 'electronics', color: 'white',
      keywords: ['ايربودز'], tags: ['travel'], notes: 'العلبة البيضاء', favorite: true,
      originalImageId: 'img1', cutoutImageId: 'img2', currentLocationId: 'p1', source: 'ai_single',
      createdAt: ts, updatedAt: ts, lastMovedAt: ts, deletedAt: null,
    };
    const row = toRemote.item(item, 'user-1');
    expect(row).toMatchObject({ user_id: 'user-1', category_id: 'electronics', current_location_id: 'p1' });
    expect(fromRemote.item(row)).toEqual(item);
  });

  it('round-trips a place and a placement snapshot', () => {
    const place: Place = { id: 'p1', room: 'office', roomLabel: null, spot: 'الدرج الثاني', note: null, imageId: 'img3', createdAt: ts, updatedAt: ts, deletedAt: null };
    expect(fromRemote.place(toRemote.place(place, 'u'))).toEqual(place);
    const ev: PlacementEvent = { id: 'e1', itemId: 'i1', placeId: 'p1', room: 'office', roomLabel: null, spot: 'الدرج الثاني', note: null, imageId: 'img3', placedAt: ts, createdAt: ts };
    expect(fromRemote.placement(toRemote.placement(ev, 'u'))).toEqual(ev);
  });

  it('keeps the local file path when the server copy has none', () => {
    const local = { id: 'img1', kind: 'item_original' as const, localUri: 'file:///x.jpg', remotePath: null, width: 10, height: 10, createdAt: ts };
    const merged = fromRemote.image({ id: 'img1', kind: 'item_original', storage_path: 'u/img1.jpg', width: 10, height: 10, created_at: ts }, local);
    expect(merged).toMatchObject({ localUri: 'file:///x.jpg', remotePath: 'u/img1.jpg' });
  });
});
