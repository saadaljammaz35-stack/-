// User data stores. Each one is persisted locally and included in backups and sync.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { civilKey, type CivilDate } from '@/lib/hijri';
import { createKhatma, pause, recordReading, resume, type Khatma, type KhatmaPlan } from '@/lib/khatma';

import { jsonStorage, storageKey } from './storage';

// ---------- Quran reading ----------

export type Bookmark = { verseId: number; page: number; label: string; createdAt: number };
export type LastRead = { page: number; verseId: number | null; at: number };

type QuranState = {
  lastRead: LastRead | null;
  bookmarks: Bookmark[];
  setLastRead: (page: number, verseId?: number | null) => void;
  toggleBookmark: (b: Omit<Bookmark, 'createdAt'>) => void;
  removeBookmark: (verseId: number) => void;
};

export const useQuranStore = create<QuranState>()(
  persist(
    (set) => ({
      lastRead: null,
      bookmarks: [],
      setLastRead: (page, verseId = null) => set({ lastRead: { page, verseId, at: Date.now() } }),
      toggleBookmark: (b) =>
        set((s) =>
          s.bookmarks.some((x) => x.verseId === b.verseId)
            ? { bookmarks: s.bookmarks.filter((x) => x.verseId !== b.verseId) }
            : { bookmarks: [{ ...b, createdAt: Date.now() }, ...s.bookmarks] },
        ),
      removeBookmark: (verseId) => set((s) => ({ bookmarks: s.bookmarks.filter((x) => x.verseId !== verseId) })),
    }),
    { name: storageKey('quran'), storage: jsonStorage, version: 1 },
  ),
);

// ---------- Khatma ----------

type KhatmaState = {
  khatmas: Khatma[];
  add: (input: { name: string; plan: KhatmaPlan; start: CivilDate; reminder?: Khatma['reminder'] }) => string;
  read: (id: string, page: number, today: CivilDate) => void;
  pause: (id: string, today: CivilDate) => void;
  resume: (id: string, today: CivilDate) => void;
  update: (id: string, patch: Partial<Pick<Khatma, 'name' | 'reminder'>>) => void;
  remove: (id: string) => void;
};

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export const useKhatmaStore = create<KhatmaState>()(
  persist(
    (set) => ({
      khatmas: [],
      add: (input) => {
        const id = newId();
        set((s) => ({ khatmas: [createKhatma({ id, now: Date.now(), ...input }), ...s.khatmas] }));
        return id;
      },
      read: (id, page, today) =>
        set((s) => ({ khatmas: s.khatmas.map((k) => (k.id === id ? recordReading(k, page, today) : k)) })),
      pause: (id, today) => set((s) => ({ khatmas: s.khatmas.map((k) => (k.id === id ? pause(k, today) : k)) })),
      resume: (id, today) => set((s) => ({ khatmas: s.khatmas.map((k) => (k.id === id ? resume(k, today) : k)) })),
      update: (id, patch) => set((s) => ({ khatmas: s.khatmas.map((k) => (k.id === id ? { ...k, ...patch } : k)) })),
      remove: (id) => set((s) => ({ khatmas: s.khatmas.filter((k) => k.id !== id) })),
    }),
    { name: storageKey('khatma'), storage: jsonStorage, version: 1 },
  ),
);

// ---------- Adhkar progress & favourites ----------

type AdhkarState = {
  /** Counter progress per day: date → item key → count done. Kept for 7 days. */
  progress: Record<string, Record<string, number>>;
  favorites: string[];
  increment: (date: CivilDate, key: string, max: number) => number;
  setCount: (date: CivilDate, key: string, count: number) => void;
  resetKeys: (date: CivilDate, keys: string[]) => void;
  toggleFavorite: (key: string) => void;
};

function pruneDays<T>(map: Record<string, T>, keep = 7): Record<string, T> {
  const keys = Object.keys(map).sort().slice(-keep);
  return Object.fromEntries(keys.map((k) => [k, map[k]]));
}

export const useAdhkarStore = create<AdhkarState>()(
  persist(
    (set, get) => ({
      progress: {},
      favorites: [],
      increment: (date, key, max) => {
        const day = civilKey(date);
        const current = get().progress[day]?.[key] ?? 0;
        const next = Math.min(max, current + 1);
        set((s) => ({ progress: pruneDays({ ...s.progress, [day]: { ...s.progress[day], [key]: next } }) }));
        return next;
      },
      setCount: (date, key, count) => {
        const day = civilKey(date);
        set((s) => ({ progress: pruneDays({ ...s.progress, [day]: { ...s.progress[day], [key]: count } }) }));
      },
      resetKeys: (date, keys) => {
        const day = civilKey(date);
        set((s) => {
          const copy = { ...s.progress[day] };
          for (const k of keys) delete copy[k];
          return { progress: { ...s.progress, [day]: copy } };
        });
      },
      toggleFavorite: (key) =>
        set((s) => ({
          favorites: s.favorites.includes(key) ? s.favorites.filter((k) => k !== key) : [key, ...s.favorites],
        })),
    }),
    { name: storageKey('adhkar'), storage: jsonStorage, version: 1 },
  ),
);

// ---------- Hadith favourites ----------

export type HadithRef = { kind: 'book'; book: string; n: number } | { kind: 'enc'; id: number };
const refKey = (r: HadithRef) => (r.kind === 'book' ? `book:${r.book}:${r.n}` : `enc:${r.id}`);

type HadithState = {
  favorites: (HadithRef & { title: string; at: number })[];
  isFavorite: (r: HadithRef) => boolean;
  toggle: (r: HadithRef, title: string) => void;
};

export const useHadithStore = create<HadithState>()(
  persist(
    (set, get) => ({
      favorites: [],
      isFavorite: (r) => get().favorites.some((f) => refKey(f) === refKey(r)),
      toggle: (r, title) =>
        set((s) =>
          s.favorites.some((f) => refKey(f) === refKey(r))
            ? { favorites: s.favorites.filter((f) => refKey(f) !== refKey(r)) }
            : { favorites: [{ ...r, title, at: Date.now() }, ...s.favorites] },
        ),
    }),
    { name: storageKey('hadith'), storage: jsonStorage, version: 1 },
  ),
);

// ---------- Tasbih ----------

export type TasbihCounter = { id: string; label: string; target: number; count: number; rounds: number };

type TasbihState = {
  counters: TasbihCounter[];
  activeId: string;
  dailyGoal: number;
  history: Record<string, number>;
  vibrate: boolean;
  tap: (today: CivilDate) => TasbihCounter;
  reset: (id: string) => void;
  select: (id: string) => void;
  add: (label: string, target: number) => void;
  remove: (id: string) => void;
  setGoal: (n: number) => void;
  setVibrate: (v: boolean) => void;
};

// Phrases from Hisn al-Muslim's chapter on tasbih, tahmid, tahlil and takbir.
const DEFAULT_COUNTERS: TasbihCounter[] = [
  { id: 'subhanallah', label: 'سُبْحَانَ اللَّهِ', target: 33, count: 0, rounds: 0 },
  { id: 'alhamdulillah', label: 'الْحَمْدُ لِلَّهِ', target: 33, count: 0, rounds: 0 },
  { id: 'allahuakbar', label: 'اللَّهُ أَكْبَرُ', target: 34, count: 0, rounds: 0 },
  { id: 'tahlil', label: 'لَا إِلَهَ إِلَّا اللَّهُ', target: 100, count: 0, rounds: 0 },
  { id: 'istighfar', label: 'أَسْتَغْفِرُ اللَّهَ', target: 100, count: 0, rounds: 0 },
  { id: 'subhanallahi-wabihamdih', label: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ', target: 100, count: 0, rounds: 0 },
];

export const useTasbihStore = create<TasbihState>()(
  persist(
    (set, get) => ({
      counters: DEFAULT_COUNTERS,
      activeId: DEFAULT_COUNTERS[0].id,
      dailyGoal: 100,
      history: {},
      vibrate: true,
      tap: (today) => {
        const day = civilKey(today);
        let updated: TasbihCounter | null = null;
        set((s) => {
          const counters = s.counters.map((c) => {
            if (c.id !== s.activeId) return c;
            const count = c.count + 1;
            updated =
              c.target > 0 && count >= c.target
                ? { ...c, count: 0, rounds: c.rounds + 1 }
                : { ...c, count };
            return updated;
          });
          return { counters, history: pruneDays({ ...s.history, [day]: (s.history[day] ?? 0) + 1 }, 60) };
        });
        return updated ?? get().counters[0];
      },
      reset: (id) => set((s) => ({ counters: s.counters.map((c) => (c.id === id ? { ...c, count: 0, rounds: 0 } : c)) })),
      select: (id) => set({ activeId: id }),
      add: (label, target) =>
        set((s) => ({ counters: [...s.counters, { id: newId(), label, target, count: 0, rounds: 0 }] })),
      remove: (id) =>
        set((s) => {
          const counters = s.counters.filter((c) => c.id !== id);
          return { counters, activeId: s.activeId === id ? (counters[0]?.id ?? '') : s.activeId };
        }),
      setGoal: (n) => set({ dailyGoal: Math.max(1, Math.round(n)) }),
      setVibrate: (v) => set({ vibrate: v }),
    }),
    { name: storageKey('tasbih'), storage: jsonStorage, version: 1 },
  ),
);

// ---------- Fasting log ----------

type FastingState = {
  days: Record<string, 'fasted' | 'missed' | 'excused'>;
  mark: (date: CivilDate, value: 'fasted' | 'missed' | 'excused' | null) => void;
};

export const useFastingStore = create<FastingState>()(
  persist(
    (set) => ({
      days: {},
      mark: (date, value) =>
        set((s) => {
          const days = { ...s.days };
          if (value) days[civilKey(date)] = value;
          else delete days[civilKey(date)];
          return { days };
        }),
    }),
    { name: storageKey('fasting'), storage: jsonStorage, version: 1 },
  ),
);

// ---------- Recent activity ----------

export type Activity = { key: string; title: string; route: string; icon: string; at: number };

type ActivityState = {
  items: Activity[];
  record: (a: Omit<Activity, 'at'>) => void;
  clear: () => void;
};

export const useActivityStore = create<ActivityState>()(
  persist(
    (set) => ({
      items: [],
      record: (a) =>
        set((s) => ({ items: [{ ...a, at: Date.now() }, ...s.items.filter((x) => x.key !== a.key)].slice(0, 12) })),
      clear: () => set({ items: [] }),
    }),
    { name: storageKey('activity'), storage: jsonStorage, version: 1 },
  ),
);
