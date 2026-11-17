/**
 * End-to-end scenario from the product brief, at the service layer:
 *  photograph earphones -> background removal -> name -> photograph desk drawer
 *  -> save -> close app -> reopen -> "وين حطيت سماعتي؟" -> result + place photo
 *  -> move earphones -> update -> new place shown, old one kept in history.
 *
 * Account creation (step 1) and RLS isolation are exercised against a real local
 * Supabase stack in supabase/tests (see reports/TEST-REPORT.md).
 */
import { MemoryStore } from '@/data/memoryStore';
import { getCompiledLexicon } from '@/features/dialect/lexiconProvider';
import { SearchIndex } from '@/features/search/searchEngine';
import { setClock } from '@/lib/clock';
import { parseRecognizedItem } from '@/services/ai/aiClient';
import { ItemService } from '@/services/itemService';
import { runSearch } from '@/services/searchService';

async function openApp(snapshot?: string) {
  const store = new MemoryStore(snapshot);
  const service = new ItemService(store);
  const index = new SearchIndex(getCompiledLexicon());
  const refresh = async () => {
    const items = await service.listItems();
    const places = await service.listPlaces();
    const byId = new Map(places.map((p) => [p.id, p]));
    index.rebuild(
      items.map((item) => ({ item, place: item.currentLocationId ? (byId.get(item.currentLocationId) ?? null) : null })),
      places,
    );
  };
  await refresh();
  return { store, service, index, refresh };
}

describe('brief scenario: earphones in the desk drawer', () => {
  let t = Date.parse('2026-11-17T10:00:00+03:00');
  beforeAll(() => setClock(() => new Date(t)));
  afterAll(() => setClock(null));

  it('runs the full flow and survives an app restart', async () => {
    // --- session 1 -------------------------------------------------------
    let app = await openApp();

    // 2. photograph the earphones (camera output stored privately)
    const original = await app.service.saveImage({ kind: 'item_original', localUri: 'file:///doc/images/a.jpg', remotePath: null, width: 1600, height: 1200 });
    // 3. background removal succeeded -> cutout stored next to the original (original kept)
    const cutout = await app.service.saveImage({ kind: 'item_cutout', localUri: 'file:///doc/images/a.png', remotePath: null, width: 900, height: 900 });
    // 4. recognition suggests a name; the user can edit it
    const suggestion = parseRecognizedItem({ name_ar: 'سماعة AirPods', name_en: 'AirPods', category: 'electronics', color: 'white', keywords: ['ايربودز', 'سماعات'], confidence: 0.93 });
    expect(suggestion).not.toBeNull();
    // 5. photograph the desk drawer
    const drawerPhoto = await app.service.saveImage({ kind: 'location', localUri: 'file:///doc/images/d.jpg', remotePath: null, width: 1600, height: 1200 });
    // 6. save
    const item = await app.service.createItem(
      {
        name: suggestion!.nameAr,
        nameEn: suggestion!.nameEn,
        category: suggestion!.category,
        color: suggestion!.color,
        keywords: suggestion!.keywords,
        originalImageId: original.id,
        cutoutImageId: cutout.id,
        source: 'ai_single',
      },
      { newPlace: { room: 'bedroom', spot: 'الدرج الثاني في المكتب', imageId: drawerPhoto.id } },
    );
    expect(item.originalImageId).toBe(original.id); // original is never discarded

    // 7. close the app (only what was persisted survives)
    const persisted = app.store.snapshot();

    // --- session 2 -------------------------------------------------------
    t += 3 * 3600_000;
    // 8. reopen
    app = await openApp(persisted);
    // 9. "وين حطيت سماعتي؟"
    const res = await runSearch('وين حطيت سماعتي؟', { index: app.index, lex: getCompiledLexicon(), now: new Date(t) });
    // 10. the item and the place photo come back, with the date it was recorded
    expect(res.status).toBe('ok');
    expect(res.hits[0].item.id).toBe(item.id);
    expect(res.hits[0].place?.spot).toBe('الدرج الثاني في المكتب');
    const full = await app.service.getItemWithPlace(item.id);
    expect(full?.placeImage?.id).toBe(drawerPhoto.id);
    expect(full?.image?.id).toBe(cutout.id);
    expect(full?.item.lastMovedAt).toBe('2026-11-17T07:00:00.000Z');

    // 11-12. move the earphones and record the new place
    t += 24 * 3600_000;
    const shelfPhoto = await app.service.saveImage({ kind: 'location', localUri: 'file:///doc/images/s.jpg', remotePath: null, width: 1600, height: 1200 });
    await app.service.moveItem(item.id, { newPlace: { room: 'living', spot: 'رف التلفزيون', imageId: shelfPhoto.id } });
    await app.refresh();

    // 13. the new place is shown; the old one stays in history
    const again = await runSearch('فين خليت السماعة؟', { index: app.index, lex: getCompiledLexicon(), now: new Date(t) });
    expect(again.hits[0].place?.spot).toBe('رف التلفزيون');
    const history = await app.service.history(item.id);
    expect(history.map((h) => h.spot)).toEqual(['رف التلفزيون', 'الدرج الثاني في المكتب']);
    expect(history[1].imageId).toBe(drawerPhoto.id);
  });

  it('does not invent an answer for something never registered', async () => {
    const app = await openApp();
    const res = await runSearch('وين حطيت جواز السفر؟', { index: app.index, lex: getCompiledLexicon() });
    expect(res.status).toBe('no_match');
    expect(res.hits).toHaveLength(0);
  });

  it('asks to rephrase on noise', async () => {
    const app = await openApp();
    const res = await runSearch('اممم ااه', { index: app.index, lex: getCompiledLexicon() });
    expect(res.status).toBe('needs_rephrase');
  });
});
