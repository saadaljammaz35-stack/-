// User data stores. Each one is persisted locally and included in backups and sync.
import { randomUUID } from 'expo-crypto';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { gradeCard, type HifzCard, type HifzGrade } from '@/lib/hifz';
import { crownSurah, learnVerse, resetSurah, type Kid } from '@/lib/kids';
import { civilKey, type CivilDate } from '@/lib/hijri';
import { adjustQada, EMPTY_QADA, markPrayer, toggleNafila, type FardId, type NafilaId, type PrayerLog, type PrayerMark } from '@/lib/prayer-log';
import { createKhatma, pause, recordReading, resume, type Khatma, type KhatmaPlan } from '@/lib/khatma';
import { addVerse, type Ranges } from '@/lib/listening';
import { addPaceSample } from '@/lib/pace';

import { jsonStorage, storageKey } from './storage';

// ---------- Quran reading ----------

/** Keeps the most recent `keep` days of a date-keyed map. */
function pruneDays<T>(map: Record<string, T>, keep = 7): Record<string, T> {
  const keys = Object.keys(map).sort().slice(-keep);
  return Object.fromEntries(keys.map((k) => [k, map[k]]));
}

export type Bookmark = { verseId: number; page: number; label: string; createdAt: number };
export type LastRead = { page: number; verseId: number | null; at: number };
/** «وقفت هنا»: where each person sharing this phone stopped. */
export type ReaderPlace = { id: string; name: string; page: number; at: number };

type QuranState = {
  lastRead: LastRead | null;
  bookmarks: Bookmark[];
  /** Mushaf pages read on each day (civil date key → page numbers), for the daily goal and stats. */
  pagesRead: Record<string, number[]>;
  /** Seconds each recent page stayed open, for the reading pace. */
  pace: number[];
  readers: ReaderPlace[];
  setLastRead: (page: number, verseId?: number | null) => void;
  recordPage: (date: CivilDate, page: number) => void;
  recordPace: (seconds: number) => void;
  placeReader: (name: string, page: number) => void;
  removeReader: (id: string) => void;
  toggleBookmark: (b: Omit<Bookmark, 'createdAt'>) => void;
  removeBookmark: (verseId: number) => void;
};

export const useQuranStore = create<QuranState>()(
  persist(
    (set) => ({
      lastRead: null,
      bookmarks: [],
      pagesRead: {},
      pace: [],
      readers: [],
      setLastRead: (page, verseId = null) => set({ lastRead: { page, verseId, at: Date.now() } }),
      recordPace: (seconds) => set((s) => ({ pace: addPaceSample(s.pace, seconds) })),
      placeReader: (name, page) =>
        set((s) => {
          const clean = name.trim().slice(0, 30);
          if (!clean) return s;
          const prev = s.readers.find((r) => r.name === clean);
          const next = { id: prev?.id ?? randomUUID(), name: clean, page, at: Date.now() };
          return { readers: [next, ...s.readers.filter((r) => r.name !== clean)].slice(0, 12) };
        }),
      removeReader: (id) => set((s) => ({ readers: s.readers.filter((r) => r.id !== id) })),
      recordPage: (date, page) =>
        set((s) => {
          const key = civilKey(date);
          const pages = s.pagesRead[key] ?? [];
          if (pages.includes(page)) return s;
          return { pagesRead: pruneDays({ ...s.pagesRead, [key]: [...pages, page] }, 400) };
        }),
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
  update: (id: string, patch: Partial<Pick<Khatma, 'name' | 'reminder' | 'adaptive'>>) => void;
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

/**
 * Counter progress is kept per list, so a dhikr said in the morning does not show as done in
 * the evening list that shares it.
 */
export const adhkarProgressKey = (listId: string, itemKey: string) => `${listId}|${itemKey}`;
const ADHKAR_DAYS = 40;

type AdhkarState = {
  /** Counter progress per day: date → list|item key → count done. Kept for 40 days (for the monthly harvest). */
  progress: Record<string, Record<string, number>>;
  favorites: string[];
  increment: (date: CivilDate, key: string, max: number) => number;
  setCount: (date: CivilDate, key: string, count: number) => void;
  resetKeys: (date: CivilDate, keys: string[]) => void;
  toggleFavorite: (key: string) => void;
};

export const useAdhkarStore = create<AdhkarState>()(
  persist(
    (set, get) => ({
      progress: {},
      favorites: [],
      increment: (date, key, max) => {
        const day = civilKey(date);
        const current = get().progress[day]?.[key] ?? 0;
        const next = Math.min(max, current + 1);
        set((s) => ({ progress: pruneDays({ ...s.progress, [day]: { ...s.progress[day], [key]: next } }, ADHKAR_DAYS) }));
        return next;
      },
      setCount: (date, key, count) => {
        const day = civilKey(date);
        set((s) => ({ progress: pruneDays({ ...s.progress, [day]: { ...s.progress[day], [key]: count } }, ADHKAR_DAYS) }));
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

// ---------- Memorisation (hifz) ----------

export type HifzHide = 'blank' | 'first';
export type HifzPlan = { surah: number; from: number; to: number; next: number };

type HifzState = {
  /** Keyed by verse id. */
  cards: Record<string, HifzCard>;
  /** The passage being learned, to pick up where the user stopped. */
  plan: HifzPlan | null;
  /** How many times each verse is played before it is hidden. */
  repeat: number;
  hide: HifzHide;
  grade: (verseId: number, grade: HifzGrade, today: CivilDate) => void;
  setPlan: (plan: HifzPlan | null) => void;
  set: (patch: Partial<Pick<HifzState, 'repeat' | 'hide'>>) => void;
  forget: (verseIds: number[]) => void;
};

export const useHifzStore = create<HifzState>()(
  persist(
    (set) => ({
      cards: {},
      plan: null,
      repeat: 3,
      hide: 'first',
      grade: (verseId, grade, today) =>
        set((s) => ({ cards: { ...s.cards, [verseId]: gradeCard(s.cards[verseId], grade, today) } })),
      setPlan: (plan) => set({ plan }),
      set: (patch) => set(patch),
      forget: (verseIds) =>
        set((s) => {
          const cards = { ...s.cards };
          for (const id of verseIds) delete cards[id];
          return { cards };
        }),
    }),
    { name: storageKey('hifz'), storage: jsonStorage, version: 1 },
  ),
);

// ---------- Prayer log (صلاتي) ----------

type PrayerLogState = PrayerLog & {
  mark: (date: CivilDate, id: FardId, mark: PrayerMark | null) => void;
  toggleNafila: (date: CivilDate, id: NafilaId) => void;
  adjustQada: (id: FardId, delta: number) => void;
};

const logOf = (s: PrayerLog): PrayerLog => ({ days: s.days, qada: s.qada });

export const usePrayerLogStore = create<PrayerLogState>()(
  persist(
    (set) => ({
      days: {},
      qada: { ...EMPTY_QADA },
      mark: (date, id, mark) => set((s) => markPrayer(logOf(s), date, id, mark)),
      toggleNafila: (date, id) => set((s) => toggleNafila(logOf(s), date, id)),
      adjustQada: (id, delta) => set((s) => adjustQada(logOf(s), id, delta)),
    }),
    { name: storageKey('prayers'), storage: jsonStorage, version: 1 },
  ),
);

// ---------- Group khatmas ----------

export type JoinedGroup = { code: string; name: string; at: number };
export type JoinedCircle = { code: string; name: string; kind: 'family' | 'buddy'; at: number };

type GroupState = {
  /** This device's secret: proves which juz and group khatmas are its own. Never shown. */
  token: string;
  /** The name others see next to the juz this device takes. */
  name: string;
  joined: JoinedGroup[];
  /** «دائرة العائلة» and «رفيق الأذكار» circles this device is in. */
  circles: JoinedCircle[];
  setName: (name: string) => void;
  remember: (code: string, name: string) => void;
  forget: (code: string) => void;
  rememberCircle: (code: string, name: string, kind: JoinedCircle['kind']) => void;
  forgetCircle: (code: string) => void;
};

export const useGroupStore = create<GroupState>()(
  persist(
    (set) => ({
      token: randomUUID(),
      name: '',
      joined: [],
      setName: (name) => set({ name: name.trim().slice(0, 40) }),
      remember: (code, name) =>
        set((s) => ({ joined: [{ code, name, at: s.joined.find((g) => g.code === code)?.at ?? Date.now() }, ...s.joined.filter((g) => g.code !== code)] })),
      forget: (code) => set((s) => ({ joined: s.joined.filter((g) => g.code !== code) })),
      circles: [],
      rememberCircle: (code, name, kind) =>
        set((s) => ({ circles: [{ code, name, kind, at: s.circles.find((c) => c.code === code)?.at ?? Date.now() }, ...s.circles.filter((c) => c.code !== code)] })),
      forgetCircle: (code) => set((s) => ({ circles: s.circles.filter((c) => c.code !== code) })),
    }),
    { name: storageKey('groups'), storage: jsonStorage, version: 1 },
  ),
);

// ---------- دعائي: the personal dua notebook ----------

export type MyDua = { id: string; text: string; /** Whom it is for, e.g. «لأمي». */ for: string; createdAt: number; answeredAt: number | null };

type DuaState = {
  duas: MyDua[];
  add: (text: string, forWhom?: string) => void;
  edit: (id: string, text: string, forWhom: string) => void;
  remove: (id: string) => void;
  /** Marks a dua answered (الحمد لله), or back to pending. */
  toggleAnswered: (id: string) => void;
};

export const useDuaStore = create<DuaState>()(
  persist(
    (set) => ({
      duas: [],
      add: (text, forWhom = '') =>
        set((s) => ({ duas: [{ id: randomUUID(), text: text.trim(), for: forWhom.trim(), createdAt: Date.now(), answeredAt: null }, ...s.duas] })),
      edit: (id, text, forWhom) => set((s) => ({ duas: s.duas.map((d) => (d.id === id ? { ...d, text: text.trim(), for: forWhom.trim() } : d)) })),
      remove: (id) => set((s) => ({ duas: s.duas.filter((d) => d.id !== id) })),
      toggleAnswered: (id) => set((s) => ({ duas: s.duas.map((d) => (d.id === id ? { ...d, answeredAt: d.answeredAt ? null : Date.now() } : d)) })),
    }),
    { name: storageKey('duas'), storage: jsonStorage, version: 1 },
  ),
);

// ---------- Listening khatma (ختمة السماع) ----------

type ListenState = {
  /** Verse ids heard in full, as merged ranges. */
  heard: Ranges;
  startedAt: number | null;
  /** Completed listening khatmas (timestamps). */
  completed: number[];
  hear: (verseId: number) => void;
  /** Records a completed khatma and starts over. */
  finish: () => void;
  reset: () => void;
};

export const useListenStore = create<ListenState>()(
  persist(
    (set) => ({
      heard: [],
      startedAt: null,
      completed: [],
      hear: (verseId) =>
        set((s) => {
          const heard = addVerse(s.heard, verseId);
          return heard === s.heard ? s : { heard, startedAt: s.startedAt ?? Date.now() };
        }),
      finish: () => set((s) => ({ heard: [], startedAt: null, completed: [...s.completed, Date.now()] })),
      reset: () => set({ heard: [], startedAt: null }),
    }),
    { name: storageKey('listening'), storage: jsonStorage, version: 1 },
  ),
);

// ---------- Walks to the mosque (خطواتك إلى المسجد) ----------

export type Walk = { date: string; prayer: FardId | null; steps: number; startedAt: number; minutes: number };

type WalkState = {
  walks: Walk[];
  /** The walk under way, if any. */
  active: { startedAt: number; prayer: FardId | null } | null;
  start: (prayer: FardId | null) => void;
  finish: (date: CivilDate, steps: number) => void;
  cancel: () => void;
};

export const useWalkStore = create<WalkState>()(
  persist(
    (set) => ({
      walks: [],
      active: null,
      start: (prayer) => set({ active: { startedAt: Date.now(), prayer } }),
      finish: (date, steps) =>
        set((s) => {
          if (!s.active) return s;
          const walk: Walk = { date: civilKey(date), prayer: s.active.prayer, steps: Math.max(0, Math.round(steps)), startedAt: s.active.startedAt, minutes: Math.max(1, Math.round((Date.now() - s.active.startedAt) / 60000)) };
          return { active: null, walks: [walk, ...s.walks].slice(0, 500) };
        }),
      cancel: () => set({ active: null }),
    }),
    { name: storageKey('walks'), storage: jsonStorage, version: 1 },
  ),
);

// ---------- Qada plan (خطة القضاء) ----------

type QadaState = {
  /** Prayers made up alongside each daily prayer. */
  perPrayer: number;
  /** Fasts owed (entered by the user). */
  fastsOwed: number;
  /** Weekdays for making up fasts (0 = Sunday). */
  fastWeekdays: number[];
  /** Prayers made up today, by prayer, to show the day's progress. */
  today: { date: string; done: Partial<Record<FardId, number>> };
  set: (patch: Partial<Pick<QadaState, 'perPrayer' | 'fastsOwed' | 'fastWeekdays'>>) => void;
  /** Records one prayer made up today. */
  madeUp: (date: CivilDate, id: FardId) => void;
};

export const useQadaStore = create<QadaState>()(
  persist(
    (set) => ({
      perPrayer: 1,
      fastsOwed: 0,
      fastWeekdays: [1, 4],
      today: { date: '', done: {} },
      set: (patch) => set(patch),
      madeUp: (date, id) =>
        set((s) => {
          const key = civilKey(date);
          const done = s.today.date === key ? s.today.done : {};
          return { today: { date: key, done: { ...done, [id]: (done[id] ?? 0) + 1 } } };
        }),
    }),
    { name: storageKey('qada'), storage: jsonStorage, version: 1 },
  ),
);

// ---------- حفظ الصغار: children's profiles for learning the short surahs ----------

type KidsState = {
  kids: Kid[];
  add: (name: string, color: string) => string;
  rename: (id: string, name: string) => void;
  remove: (id: string) => void;
  learn: (id: string, surah: number, ayah: number) => void;
  crown: (id: string, surah: number, versesCount: number, crowned?: boolean) => void;
  reset: (id: string, surah: number) => void;
};

const updateKid = (kids: Kid[], id: string, f: (k: Kid) => Kid) => kids.map((k) => (k.id === id ? f(k) : k));

export const useKidsStore = create<KidsState>()(
  persist(
    (set) => ({
      kids: [],
      add: (name, color) => {
        const id = randomUUID();
        set((s) => ({ kids: [...s.kids, { id, name: name.trim().slice(0, 30), color, createdAt: Date.now(), surahs: {} }] }));
        return id;
      },
      rename: (id, name) => set((s) => ({ kids: updateKid(s.kids, id, (k) => ({ ...k, name: name.trim().slice(0, 30) || k.name })) })),
      remove: (id) => set((s) => ({ kids: s.kids.filter((k) => k.id !== id) })),
      learn: (id, surah, ayah) => set((s) => ({ kids: updateKid(s.kids, id, (k) => learnVerse(k, surah, ayah)) })),
      crown: (id, surah, versesCount, crowned) => set((s) => ({ kids: updateKid(s.kids, id, (k) => crownSurah(k, surah, versesCount, crowned)) })),
      reset: (id, surah) => set((s) => ({ kids: updateKid(s.kids, id, (k) => resetSurah(k, surah)) })),
    }),
    { name: storageKey('kids'), storage: jsonStorage, version: 1 },
  ),
);

// ---------- الاستخارة: matters the user sought Allah's choice in ----------

export type IstikharaEntry = { id: string; matter: string; createdAt: number; prayed: number[]; outcome: string; closedAt: number | null };

type IstikharaState = {
  entries: IstikharaEntry[];
  add: (matter: string) => void;
  prayed: (id: string) => void;
  setOutcome: (id: string, outcome: string) => void;
  close: (id: string, closed: boolean) => void;
  remove: (id: string) => void;
};

const updateEntry = (list: IstikharaEntry[], id: string, f: (e: IstikharaEntry) => IstikharaEntry) => list.map((e) => (e.id === id ? f(e) : e));

export const useIstikharaStore = create<IstikharaState>()(
  persist(
    (set) => ({
      entries: [],
      add: (matter) => set((s) => ({ entries: [{ id: randomUUID(), matter: matter.trim().slice(0, 200), createdAt: Date.now(), prayed: [], outcome: '', closedAt: null }, ...s.entries] })),
      prayed: (id) => set((s) => ({ entries: updateEntry(s.entries, id, (e) => ({ ...e, prayed: [...e.prayed, Date.now()] })) })),
      setOutcome: (id, outcome) => set((s) => ({ entries: updateEntry(s.entries, id, (e) => ({ ...e, outcome: outcome.slice(0, 500) })) })),
      close: (id, closed) => set((s) => ({ entries: updateEntry(s.entries, id, (e) => ({ ...e, closedAt: closed ? Date.now() : null })) })),
      remove: (id) => set((s) => ({ entries: s.entries.filter((e) => e.id !== id) })),
    }),
    { name: storageKey('istikhara'), storage: jsonStorage, version: 1 },
  ),
);
