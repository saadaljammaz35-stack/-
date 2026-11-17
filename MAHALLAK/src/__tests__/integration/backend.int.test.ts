/**
 * @jest-environment node
 *
 * Backend integration tests against a REAL local Supabase stack
 * (Postgres + Auth + PostgREST + Storage + Edge Runtime in Docker):
 *   npx supabase start && npx supabase functions serve --env-file <test env>
 *   MAHALLAK_IT=1 SUPABASE_IT_URL=... SUPABASE_IT_ANON_KEY=... SUPABASE_IT_SERVICE_KEY=... npx jest backend.int
 * Skipped automatically when those variables are absent.
 */
import { createClient } from '@supabase/supabase-js';
// jest-expo swaps the global fetch for Expo's native fetch (stubbed in tests); use a real HTTP client.
import { fetch as httpFetch } from 'undici';

import { MemoryStore } from '@/data/memoryStore';
import type { Item } from '@/domain/models';
import { validateLexicon } from '@/features/dialect/lexiconProvider';
import { createChunkedStorage } from '@/services/auth/secureSessionStorage';
import { ItemService } from '@/services/itemService';
import { SyncService } from '@/services/sync/syncService';

const URL_ = process.env.SUPABASE_IT_URL ?? '';
const ANON = process.env.SUPABASE_IT_ANON_KEY ?? '';
const SERVICE = process.env.SUPABASE_IT_SERVICE_KEY ?? '';
const WEBHOOK = process.env.SUPABASE_IT_WEBHOOK_AUTH ?? 'Bearer local-test-webhook-secret';
const FUNCTIONS = process.env.SUPABASE_IT_FUNCTIONS_URL ?? `${URL_}/functions/v1`;
const run = process.env.MAHALLAK_IT === '1' && URL_ && ANON && SERVICE ? describe : describe.skip;

// 1x1 white JPEG
const JPEG_B64 =
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
const jpegBytes = () => Uint8Array.from(Buffer.from(JPEG_B64, 'base64')).buffer;

function fakeKeychain() {
  const m = new Map<string, string>();
  return {
    m,
    getItemAsync: async (k: string) => m.get(k) ?? null,
    setItemAsync: async (k: string, v: string) => void m.set(k, v),
    deleteItemAsync: async (k: string) => void m.delete(k),
  };
}

const newClient = (storage?: ReturnType<typeof createChunkedStorage>) =>
  createClient(URL_, ANON, {
    auth: { persistSession: Boolean(storage), storage, autoRefreshToken: false },
    global: { fetch: httpFetch as unknown as typeof fetch },
  });

async function phoneSignIn(phone: string, code: string, storage?: ReturnType<typeof createChunkedStorage>) {
  const c = newClient(storage);
  const sent = await c.auth.signInWithOtp({ phone });
  expect(sent.error).toBeNull();
  const { data, error } = await c.auth.verifyOtp({ phone, token: code, type: 'sms' });
  expect(error).toBeNull();
  expect(data.session).toBeTruthy();
  return { client: c, userId: data.user!.id, token: data.session!.access_token };
}

async function invoke(fn: string, token: string | null, body: unknown, extra: Record<string, string> = {}) {
  const res = await httpFetch(`${FUNCTIONS}/${fn}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: ANON, ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra },
    body: JSON.stringify(body),
  });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json: json as Record<string, unknown> };
}

run('MAHALLAK backend (local Supabase)', () => {
  jest.setTimeout(60_000);
  const admin = createClient(URL_, SERVICE, { auth: { persistSession: false }, global: { fetch: httpFetch as unknown as typeof fetch } });
  let A: Awaited<ReturnType<typeof phoneSignIn>>;
  let B: Awaited<ReturnType<typeof phoneSignIn>>;
  const keychainA = fakeKeychain();

  beforeAll(async () => {
    // start from clean test users
    for (const phone of ['966500000001', '966500000002']) {
      const { data } = await admin.auth.admin.listUsers();
      const u = data.users.find((x) => x.phone === phone);
      if (u) await admin.auth.admin.deleteUser(u.id);
    }
    A = await phoneSignIn('+966500000001', '123456', createChunkedStorage(keychainA));
    B = await phoneSignIn('+966500000002', '654321');
  });

  // ---------------------------------------------------------------- auth
  describe('authentication', () => {
    it('creates a profile and private settings row on sign-up', async () => {
      const s = await A.client.from('user_settings').select('*').single();
      expect(s.error).toBeNull();
      expect(s.data).toMatchObject({ user_id: A.userId, ai_consent: false, ai_training_consent: false, cloud_photos: false });
      const p = await A.client.from('users').select('id').single();
      expect(p.data?.id).toBe(A.userId);
    });

    it('rejects a wrong OTP', async () => {
      const c = newClient();
      await c.auth.signInWithOtp({ phone: '+966500000001' });
      const { error } = await c.auth.verifyOtp({ phone: '+966500000001', token: '000000', type: 'sms' });
      expect(error).not.toBeNull();
    });

    it('restores the session from the secure keychain after an app restart, refreshes it, and signs out', async () => {
      expect(keychainA.m.size).toBeGreaterThan(0);
      const restarted = newClient(createChunkedStorage(keychainA));
      const { data } = await restarted.auth.getSession();
      expect(data.session?.user.id).toBe(A.userId);
      const user = await restarted.auth.getUser();
      expect(user.data.user?.id).toBe(A.userId);
      const refreshed = await restarted.auth.refreshSession();
      expect(refreshed.error).toBeNull();
      expect(refreshed.data.session?.access_token).toBeTruthy();

      // sign-out on a separate session copy clears the keychain
      await new Promise((r) => setTimeout(r, 5500)); // OTP resend throttle (max_frequency = 5s)
      const kc2 = fakeKeychain();
      const S2 = await phoneSignIn('+966500000001', '123456', createChunkedStorage(kc2));
      await S2.client.auth.signOut({ scope: 'local' });
      expect([...kc2.m.keys()].filter((k) => !k.includes('code-verifier'))).toEqual([]);
      const after = await newClient(createChunkedStorage(kc2)).auth.getSession();
      expect(after.data.session).toBeNull();
    });
  });

  // ---------------------------------------------------------------- sync + RLS
  describe('two devices, one account, and isolation from other users', () => {
    const device1 = new MemoryStore();
    const svc1 = new ItemService(device1);
    let item: Item;

    it('pushes items, places, history and photos from device 1', async () => {
      const photo = await svc1.saveImage({ kind: 'item_original', localUri: 'mem://a.jpg', remotePath: null, width: 1, height: 1 });
      const place = await svc1.saveImage({ kind: 'location', localUri: 'mem://d.jpg', remotePath: null, width: 1, height: 1 });
      item = await svc1.createItem(
        { name: 'سماعة AirPods', category: 'electronics', color: 'white', keywords: ['ايربودز'], originalImageId: photo.id },
        { newPlace: { room: 'office', spot: 'الدرج الثاني في المكتب', imageId: place.id } },
      );
      const sync = new SyncService({ store: device1, client: A.client, userId: A.userId, options: () => ({ cloudPhotos: true }), readBytes: async () => jpegBytes() });
      const report = await sync.syncNow();
      expect(report.errors).toEqual([]);
      expect(report.failed).toBe(0);
      expect(report.photosUploaded).toBe(2);
      expect(await svc1.pendingOutbox()).toEqual([]);
    });

    it('pulls everything onto device 2, then device 2 moves the item and device 1 sees it', async () => {
      const device2 = new MemoryStore();
      const svc2 = new ItemService(device2);
      const sync2 = new SyncService({ store: device2, client: A.client, userId: A.userId, options: () => ({ cloudPhotos: true }), readBytes: async () => jpegBytes() });
      const r = await sync2.syncNow();
      expect(r.errors).toEqual([]);
      const pulled = await svc2.getItemWithPlace(item.id);
      expect(pulled?.item.name).toBe('سماعة AirPods');
      expect(pulled?.place?.spot).toBe('الدرج الثاني في المكتب');
      expect(pulled?.placeImage?.remotePath).toMatch(new RegExp(`^${A.userId}/`));

      await new Promise((res) => setTimeout(res, 20));
      await svc2.moveItem(item.id, { newPlace: { room: 'living', spot: 'رف التلفزيون' } });
      expect((await sync2.syncNow()).errors).toEqual([]);

      const sync1 = new SyncService({ store: device1, client: A.client, userId: A.userId, options: () => ({ cloudPhotos: true }), readBytes: async () => jpegBytes() });
      await sync1.syncNow();
      const back = await svc1.getItemWithPlace(item.id);
      expect(back?.place?.spot).toBe('رف التلفزيون');
      expect((await svc1.history(item.id)).map((h) => h.spot)).toEqual(['رف التلفزيون', 'الدرج الثاني في المكتب']);
    });

    it("another user sees none of it and cannot touch it", async () => {
      for (const t of ['items', 'locations', 'item_location_history', 'item_images', 'location_images', 'user_settings', 'users']) {
        const { data, error } = await B.client.from(t).select('*');
        expect(error).toBeNull();
        expect((data ?? []).some((r: Record<string, unknown>) => r.user_id === A.userId || r.id === A.userId)).toBe(false);
      }
      const upd = await B.client.from('items').update({ name: 'hacked' }).eq('id', item.id).select();
      expect(upd.data ?? []).toHaveLength(0);
      const del = await B.client.from('items').delete().eq('id', item.id).select();
      expect(del.data ?? []).toHaveLength(0);
      const forged = await B.client.from('items').insert({ id: crypto.randomUUID(), user_id: A.userId, name: 'x', category_id: 'other' });
      expect(forged.error).not.toBeNull();
      const { data: aLoc } = await admin.from('locations').select('id').eq('user_id', A.userId).limit(1).single();
      const crossRef = await B.client.from('items').insert({ id: crypto.randomUUID(), name: 'x', category_id: 'other', current_location_id: aLoc!.id });
      expect(crossRef.error).not.toBeNull();
      const stillThere = await admin.from('items').select('name').eq('id', item.id).single();
      expect(stillThere.data?.name).toBe('سماعة AirPods');
    });

    it('anonymous visitors read nothing private', async () => {
      const anon = newClient();
      const { data } = await anon.from('items').select('*');
      expect(data ?? []).toEqual([]);
      const cats = await anon.from('categories').select('id');
      expect(cats.data?.length).toBe(12);
    });

    it('history is append-only for clients', async () => {
      const { data: h } = await A.client.from('item_location_history').select('id').limit(1).single();
      const res = await A.client.from('item_location_history').update({ spot: 'rewritten' }).eq('id', h!.id).select();
      expect(res.error).not.toBeNull();
    });

    it('photos are private: owner can read, others and the public cannot', async () => {
      const { data: img } = await A.client.from('location_images').select('storage_path').not('storage_path', 'is', null).limit(1).single();
      const path = img!.storage_path as string;
      const own = await A.client.storage.from('location-images').download(path);
      expect(own.error).toBeNull();
      const other = await B.client.storage.from('location-images').download(path);
      expect(other.error).not.toBeNull();
      const intrude = await B.client.storage.from('location-images').upload(`${A.userId}/evil.jpg`, jpegBytes(), { contentType: 'image/jpeg' });
      expect(intrude.error).not.toBeNull();
      const pub = await httpFetch(`${URL_}/storage/v1/object/public/location-images/${path}`);
      expect(pub.ok).toBe(false);
      const wrongType = await A.client.storage.from('item-images').upload(`${A.userId}/x.txt`, new TextEncoder().encode('hi').buffer, { contentType: 'text/plain' });
      expect(wrongType.error).not.toBeNull();
    });

    it('reports only the caller\'s own photo usage (backup cap check)', async () => {
      const a = await A.client.rpc('photo_bytes_used');
      expect(a.error).toBeNull();
      expect(Number(a.data)).toBeGreaterThan(0);
      const b = await B.client.rpc('photo_bytes_used');
      expect(Number(b.data)).toBe(0);
    });

    it('quota functions are not callable from the app', async () => {
      const { error } = await A.client.rpc('consume_ai_quota', { p_user: A.userId, p_kind: 'recognize', p_limit: 999, p_period: '1970-01-01' });
      expect(error).not.toBeNull();
    });
  });

  // ---------------------------------------------------------------- dialect lexicon delivery
  it('serves a newer dialect lexicon to the app without a rebuild', async () => {
    await admin.from('dialect_lexicons').upsert({ version: 2, is_active: true, payload: { version: 2, markers: {}, items: [{ id: 'stapler', category: 'tools', terms: ['دباسه'] }] } });
    const { data } = await newClient().from('dialect_lexicons').select('payload').eq('is_active', true).order('version', { ascending: false }).limit(1).single();
    expect(validateLexicon(data?.payload)?.version).toBe(2);
    await admin.from('dialect_lexicons').delete().eq('version', 2);
  });

  // ---------------------------------------------------------------- Edge Functions
  describe('AI edge functions (Claude API mocked locally)', () => {
    it('requires sign-in', async () => {
      const r = await invoke('ai-recognize-item', ANON, { image: JPEG_B64 });
      expect(r.status).toBe(401);
    });

    it('requires the user\'s explicit AI consent, checked on the server', async () => {
      const r = await invoke('ai-recognize-item', A.token, { image: JPEG_B64 });
      expect(r.status).toBe(403);
      expect(r.json.error).toBe('consent_required');
    });

    it('recognizes an item after consent and validates the output', async () => {
      await A.client.from('user_settings').update({ ai_consent: true }).eq('user_id', A.userId);
      const s = await A.client.from('user_settings').select('ai_consent_at').single();
      expect(s.data?.ai_consent_at).toBeTruthy();
      const r = await invoke('ai-recognize-item', A.token, { image: JPEG_B64, locale: 'ar' });
      expect(r.status).toBe(200);
      expect(r.json).toMatchObject({ name_ar: 'سماعة AirPods', category: 'electronics', color: 'white' });
    });

    it('rejects anything that is not a JPEG/PNG photo', async () => {
      const r = await invoke('ai-recognize-item', A.token, { image: Buffer.from('<?php echo 1; ?>'.repeat(20)).toString('base64') });
      expect(r.status).toBe(400);
    });

    it('detects several items for Smart Room Memory and keeps uncertain ones flagged', async () => {
      const r = await invoke('ai-detect-items', A.token, { image: JPEG_B64 });
      expect(r.status).toBe(200);
      const items = r.json.items as { confidence: number }[];
      expect(items).toHaveLength(2);
      expect(items[1].confidence).toBeLessThan(0.75);
    });

    it('restructures an unclear dialect question', async () => {
      const r = await invoke('ai-understand-query', A.token, { text: 'ابغى الشي اللي اشبك فيه الاوراق' });
      expect(r.status).toBe(200);
      expect(r.json).toMatchObject({ intent: 'find_item', item_words: ['دباسة'] });
    });

    it('reports background removal as not configured instead of faking it', async () => {
      const r = await invoke('remove-background', A.token, { image: JPEG_B64 });
      expect(r.status).toBe(501);
    });

    it('enforces the monthly free quota', async () => {
      // 1 call already used above; free tier allows 5 recognitions
      const codes: number[] = [];
      for (let i = 0; i < 5; i++) codes.push((await invoke('ai-recognize-item', A.token, { image: JPEG_B64 })).status);
      expect(codes).toEqual([200, 200, 200, 200, 429]);
      const usage = await A.client.from('ai_usage').select('*').eq('kind', 'recognize').single();
      expect(usage.data?.count).toBe(5);
      expect(Number(usage.data?.input_tokens)).toBeGreaterThan(0);
    });

    it('unlocks the paid tier only from an authenticated store webhook', async () => {
      const forged = await invoke('revenuecat-webhook', null, { event: { type: 'INITIAL_PURCHASE', app_user_id: A.userId } }, { Authorization: 'Bearer wrong' });
      expect(forged.status).toBe(401);
      const ok = await invoke('revenuecat-webhook', null, { event: { type: 'NON_RENEWING_PURCHASE', app_user_id: A.userId, product_id: 'mahallak_full_lifetime', store: 'APP_STORE', entitlement_ids: ['full_access'] } }, { Authorization: WEBHOOK });
      expect(ok.status).toBe(200);
      const ent = await A.client.from('entitlements').select('active').single();
      expect(ent.data?.active).toBe(true);
      const r = await invoke('ai-recognize-item', A.token, { image: JPEG_B64 });
      expect(r.status).toBe(200);
    });
  });

  // ---------------------------------------------------------------- export + deletion
  describe('data export and account deletion', () => {
    it('exports everything the user owns, with photo links', async () => {
      const r = await invoke('account-export', A.token, {});
      expect(r.status).toBe(200);
      expect((r.json.items as unknown[]).length).toBeGreaterThan(0);
      expect(Object.keys(r.json.photo_links as object).length).toBeGreaterThan(0);
    });

    it('deletes the account, every row and every photo', async () => {
      const up = await B.client.storage.from('item-images').upload(`${B.userId}/p.jpg`, jpegBytes(), { contentType: 'image/jpeg' });
      expect(up.error).toBeNull();
      await B.client.from('item_images').insert({ id: crypto.randomUUID(), kind: 'item_original', storage_path: `${B.userId}/p.jpg` });
      const noConfirm = await invoke('account-delete', B.token, {});
      expect(noConfirm.status).toBe(400);
      const r = await invoke('account-delete', B.token, { confirm: 'DELETE' });
      expect(r.status).toBe(200);
      expect(r.json.photos_removed).toBe(1);
      const user = await admin.auth.admin.getUserById(B.userId);
      expect(user.data.user).toBeNull();
      const rows = await admin.from('item_images').select('id').eq('user_id', B.userId);
      expect(rows.data).toEqual([]);
      const files = await admin.storage.from('item-images').list(B.userId);
      expect(files.data ?? []).toEqual([]);
    });
  });
});
