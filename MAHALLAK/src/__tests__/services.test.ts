import { MemoryStore } from '@/data/memoryStore';
import { getCompiledLexicon } from '@/features/dialect/lexiconProvider';
import { SearchIndex } from '@/features/search/searchEngine';
import { AiError, parseRecognizedItem, parseUnderstoodQuery, preselect, recognizeItem } from '@/services/ai/aiClient';
import { normalizePhone } from '@/services/auth/authService';
import { createChunkedStorage } from '@/services/auth/secureSessionStorage';
import { ItemService, ValidationError } from '@/services/itemService';
import { runSearch } from '@/services/searchService';
import { initialVoiceState, mapRecognizerError, voiceReducer, type VoiceEvent } from '@/services/speech/voiceState';
import { sanitizeSettings } from '@/state/settings';

describe('ItemService validation', () => {
  const svc = new ItemService(new MemoryStore());
  it('requires a name and a place', async () => {
    await expect(svc.createItem({ name: '  ', category: 'other' }, { newPlace: { room: 'bedroom', spot: 'x' } })).rejects.toBeInstanceOf(ValidationError);
    await expect(svc.createItem({ name: 'قلم', category: 'other' }, {})).rejects.toThrow('place_required');
    await expect(svc.createItem({ name: 'قلم', category: 'other' }, { newPlace: { room: 'bedroom', spot: ' ' } })).rejects.toThrow('spot_required');
  });
  it('rejects unknown categories and colors', async () => {
    await expect(svc.createItem({ name: 'x', category: 'weapons' as never }, { newPlace: { room: 'bedroom', spot: 'x' } })).rejects.toThrow('invalid_category');
    await expect(svc.createItem({ name: 'x', category: 'other', color: 'ultraviolet' as never }, { newPlace: { room: 'bedroom', spot: 'x' } })).rejects.toThrow('invalid_color');
  });
  it('trims, deduplicates keywords and queues sync work', async () => {
    const item = await svc.createItem({ name: '  شاحن   ابيض ', category: 'electronics', keywords: ['كيبل', 'كيبل', ' '] }, { newPlace: { room: 'kitchen', spot: 'درج المطبخ' } });
    expect(item.name).toBe('شاحن ابيض');
    expect(item.keywords).toEqual(['كيبل']);
    const outbox = await svc.pendingOutbox();
    expect(outbox.map((o) => o.table).sort()).toEqual(['items', 'placements', 'places']);
  });
  it('soft-deletes and exports without local file paths', async () => {
    const item = await svc.createItem({ name: 'نظارة', category: 'accessories' }, { newPlace: { room: 'car', spot: 'الطبلون' } });
    await svc.saveImage({ kind: 'item_original', localUri: 'file:///secret/path.jpg', remotePath: null, width: 1, height: 1 });
    await svc.deleteItem(item.id);
    expect(await svc.getItem(item.id)).toBeNull();
    const dump = JSON.stringify(await svc.exportAll());
    expect(dump).not.toContain('file:///secret');
    expect(dump).toContain('mahallak-export');
  });
  it('wipes everything on account deletion', async () => {
    await svc.wipeLocal();
    expect(await svc.listItems()).toEqual([]);
    expect(await svc.pendingOutbox()).toEqual([]);
  });
});

describe('search pipeline with optional AI fallback', () => {
  async function setup() {
    const svc = new ItemService(new MemoryStore());
    await svc.createItem({ name: 'دباسة المكتب', category: 'tools' }, { newPlace: { room: 'office', spot: 'درج المكتب' } });
    const items = await svc.listItems();
    const places = await svc.listPlaces();
    const index = new SearchIndex(getCompiledLexicon());
    index.rebuild(items.map((item) => ({ item, place: places[0] })), places);
    return index;
  }
  it('finds custom item names that are not in the lexicon', async () => {
    const index = await setup();
    const r = await runSearch('وين الدباسة', { index, lex: getCompiledLexicon() });
    expect(r.hits[0]?.item.name).toBe('دباسة المكتب');
    expect(r.usedAi).toBe(false);
  });
  it('uses the AI only to restructure an unclear question, never to invent results', async () => {
    const index = await setup();
    const invoke = jest.fn().mockResolvedValue({ data: { intent: 'find_item', item_words: ['دباسة'], place_words: [], color: null, time: null }, error: null });
    const gate = { client: { functions: { invoke } } as never, signedIn: true, consent: true, online: true };
    const r = await runSearch('ابغى الشي اللي اشبك فيه الاوراق', { index, lex: getCompiledLexicon(), ai: gate });
    expect(invoke).toHaveBeenCalledWith('ai-understand-query', expect.anything());
    expect(r.usedAi).toBe(true);
    expect(r.hits[0]?.item.name).toBe('دباسة المكتب');

    invoke.mockResolvedValueOnce({ data: { intent: 'find_item', item_words: ['طابعة'], place_words: [], color: null, time: null }, error: null });
    const none = await runSearch('وين الشي اللي يطبع', { index, lex: getCompiledLexicon(), ai: gate });
    expect(none.hits).toHaveLength(0);
  });
  it('falls back to local results when the AI fails or the user is offline', async () => {
    const index = await setup();
    const invoke = jest.fn().mockRejectedValue(new Error('boom'));
    const r = await runSearch('ممم', { index, lex: getCompiledLexicon(), ai: { client: { functions: { invoke } } as never, signedIn: true, consent: true, online: true } });
    expect(r.status).toBe('needs_rephrase');
    const off = await runSearch('ممم', { index, lex: getCompiledLexicon(), ai: { client: { functions: { invoke } } as never, signedIn: true, consent: true, online: false } });
    expect(off.status).toBe('needs_rephrase');
  });
});

describe('AI client gatekeeping and response validation', () => {
  const ok = { functions: { invoke: jest.fn() } } as never;
  it('refuses without consent, sign-in or network', async () => {
    await expect(recognizeItem({ client: ok, signedIn: true, consent: false, online: true }, 'x', 'ar')).rejects.toMatchObject({ code: 'consent_required' });
    await expect(recognizeItem({ client: ok, signedIn: false, consent: true, online: true }, 'x', 'ar')).rejects.toMatchObject({ code: 'not_signed_in' });
    await expect(recognizeItem({ client: ok, signedIn: true, consent: true, online: false }, 'x', 'ar')).rejects.toMatchObject({ code: 'offline' });
    await expect(recognizeItem({ client: null, signedIn: true, consent: true, online: true }, 'x', 'ar')).rejects.toBeInstanceOf(AiError);
  });
  it('maps quota errors', async () => {
    const client = { functions: { invoke: jest.fn().mockResolvedValue({ data: null, error: { message: 'x', context: { status: 429 } } }) } } as never;
    await expect(recognizeItem({ client, signedIn: true, consent: true, online: true }, 'x', 'ar')).rejects.toMatchObject({ code: 'quota_exceeded' });
  });
  it('sanitizes model output', () => {
    const r = parseRecognizedItem({ name_ar: 'شماغ', category: 'weapons', color: 'neon', confidence: 7, keywords: ['a', 3] });
    expect(r).toMatchObject({ nameAr: 'شماغ', category: 'other', color: null, confidence: 1, keywords: ['a'] });
    expect(parseRecognizedItem({})).toBeNull();
    expect(parseUnderstoodQuery({ intent: 'hack' })).toBeNull();
  });
  it('pre-selects only confident room-scan detections', () => {
    const items = preselect([
      { nameAr: 'a', nameEn: '', category: 'other', color: null, keywords: [], confidence: 0.9 },
      { nameAr: 'b', nameEn: '', category: 'other', color: null, keywords: [], confidence: 0.4 },
    ]);
    expect(items.map((i) => i.selected)).toEqual([true, false]);
  });
});

describe('phone numbers', () => {
  it.each([
    ['0501234567', '+966501234567'],
    ['501234567', '+966501234567'],
    ['966501234567', '+966501234567'],
    ['+966 50 123 4567', '+966501234567'],
    ['٠٥٠١٢٣٤٥٦٧', '+966501234567'],
    ['00971501234567', '+971501234567'],
  ])('%s -> %s', (input, out) => expect(normalizePhone(input)).toBe(out));
  it.each(['0112345678', '+966112345678', '123', 'abc'])('rejects %s', (input) => expect(normalizePhone(input)).toBeNull());
});

describe('session storage in the secure keychain', () => {
  function fakeKeychain() {
    const m = new Map<string, string>();
    return {
      m,
      getItemAsync: async (k: string) => m.get(k) ?? null,
      setItemAsync: async (k: string, v: string) => void m.set(k, v),
      deleteItemAsync: async (k: string) => void m.delete(k),
    };
  }
  it('splits large sessions into chunks and restores them exactly', async () => {
    const kc = fakeKeychain();
    const storage = createChunkedStorage(kc);
    const session = JSON.stringify({ access_token: 'a'.repeat(5000), refresh_token: 'r', user: { id: 'u' } });
    await storage.setItem('sb-proj-auth-token', session);
    expect(kc.m.size).toBeGreaterThan(2);
    expect(await storage.getItem('sb-proj-auth-token')).toBe(session);
    await storage.removeItem('sb-proj-auth-token');
    expect(kc.m.size).toBe(0);
    expect(await storage.getItem('sb-proj-auth-token')).toBeNull();
  });
  it('treats a half-written session as signed out', async () => {
    const kc = fakeKeychain();
    const storage = createChunkedStorage(kc);
    await storage.setItem('k', 'x'.repeat(4000));
    kc.m.delete('k.1');
    expect(await storage.getItem('k')).toBeNull();
  });
});

describe('voice search state machine (noise, permissions, failures)', () => {
  const run = (...events: VoiceEvent[]) => events.reduce(voiceReducer, initialVoiceState);
  it('goes from listening to processing with the final transcript', () => {
    const s = run({ type: 'request' }, { type: 'start' }, { type: 'result', transcript: 'وين', isFinal: false }, { type: 'result', transcript: 'وين حطيت سماعتي', isFinal: true }, { type: 'end' });
    expect(s).toMatchObject({ status: 'processing', final: 'وين حطيت سماعتي' });
  });
  it('reports denied microphone permission', () => {
    expect(run({ type: 'request' }, { type: 'denied' })).toMatchObject({ status: 'error', error: 'mic_permission' });
  });
  it('reports silence / pure noise as no speech', () => {
    expect(run({ type: 'request' }, { type: 'start' }, { type: 'volume', value: 6 }, { type: 'end' })).toMatchObject({ status: 'error', error: 'no_speech' });
  });
  it('keeps a usable partial result when the recognizer times out', () => {
    expect(run({ type: 'start' }, { type: 'result', transcript: 'وين المفتاح', isFinal: false }, { type: 'error', code: 'no-speech' })).toMatchObject({ status: 'processing', final: 'وين المفتاح' });
  });
  it('surfaces network failures and treats user abort as a reset', () => {
    expect(run({ type: 'start' }, { type: 'error', code: 'network' }).error).toBe('network');
    expect(run({ type: 'start' }, { type: 'error', code: 'aborted' })).toEqual(initialVoiceState);
    expect(mapRecognizerError('interrupted')).toBe('interrupted');
    expect(mapRecognizerError('weird')).toBe('unknown');
  });
});

describe('settings', () => {
  it('never enables training consent or photo backup implicitly', () => {
    const s = sanitizeSettings({ cloudPhotos: true, cloudSync: false, aiTrainingConsent: 'yes', language: 'fr' });
    expect(s.cloudPhotos).toBe(false);
    expect(s.aiTrainingConsent).toBe(false);
    expect(s.language).toBe('ar');
  });
});
