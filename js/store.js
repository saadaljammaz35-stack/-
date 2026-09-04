/**
 * التخزين المحلي للإعدادات والتقدّم — كل شيء يبقى على جهاز المستخدم.
 */

const KEY = 'maa-allah:v1';

const DEFAULTS = {
  // الإعدادات العامة
  theme: 'auto',              // auto | light | dark
  fontScale: 1,               // 0.9 .. 1.5
  time24: false,
  appIcon: 'star',            // مفتاح أيقونة التطبيق المختارة
  accent: '#5b7553',

  // الموقع والمواقيت
  location: { lat: 21.4225, lng: 39.8262, city: 'مكة المكرمة', tz: 'Asia/Riyadh', auto: false },
  method: 'ummAlQura',
  asrMethod: 'standard',
  hijriOffset: 0,
  adjustments: { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0, imsak: 0 },

  // التنبيهات
  notifications: {
    enabled: false,
    beforeAdhan: true,
    beforeAdhanMinutes: 5,
    atAdhan: true,
    morningAdhkar: true,
    morningAt: '06:00',
    eveningAdhkar: true,
    eveningAt: '17:30',
    quranReminder: true,
    quranAt: '20:00',
    sound: true
  },

  // شريط الصيام
  fastingBar: 'auto',         // auto (رمضان فقط) | always | off

  // الختمة
  khatmah: null,              // { startISO, days, mode, target, pagesRead, lastPage, history, completedAt }
  khatmahHistory: [],

  // المسبحة
  counter: { value: 0, target: 33, label: 'سبحان الله', sessions: 0, total: 0 },

  // التفضيلات والقراءة
  favorites: [],              // [{id, type, title, text, source}]
  progress: {},               // تقدّم قراءة الأذكار: { 'morning': {date, done:[..]} }
  lastRead: null,             // آخر صفحة قرآن
  quranBookmarks: [],
  streak: { days: 0, lastDayISO: null }
};

function deepMerge(base, patch) {
  if (Array.isArray(base) || typeof base !== 'object' || base === null) return patch ?? base;
  const out = { ...base };
  for (const k of Object.keys(patch || {})) {
    const v = patch[k];
    out[k] = (v && typeof v === 'object' && !Array.isArray(v) && typeof base[k] === 'object' && base[k] !== null)
      ? deepMerge(base[k], v)
      : v;
  }
  return out;
}

let state = load();
const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULTS);
    return deepMerge(structuredClone(DEFAULTS), JSON.parse(raw));
  } catch {
    return structuredClone(DEFAULTS);
  }
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('تعذّر الحفظ محليًّا', e);
  }
}

export const store = {
  get all() { return state; },
  get(path, fallback) {
    const parts = path.split('.');
    let cur = state;
    for (const p of parts) {
      if (cur == null) return fallback;
      cur = cur[p];
    }
    return cur === undefined ? fallback : cur;
  },
  set(path, value) {
    const parts = path.split('.');
    let cur = state;
    for (let i = 0; i < parts.length - 1; i++) {
      if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = value;
    persist();
    emit(path);
    return value;
  },
  update(fn) {
    fn(state);
    persist();
    emit('*');
  },
  reset() {
    state = structuredClone(DEFAULTS);
    persist();
    emit('*');
  },
  export() {
    return JSON.stringify(state, null, 2);
  },
  import(json) {
    state = deepMerge(structuredClone(DEFAULTS), JSON.parse(json));
    persist();
    emit('*');
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }
};

function emit(path) {
  for (const fn of listeners) {
    try { fn(path, state); } catch (e) { console.error(e); }
  }
}

/* ————— المفضلة ————— */
export function isFavorite(id) {
  return state.favorites.some((f) => f.id === id);
}

export function toggleFavorite(item) {
  const i = state.favorites.findIndex((f) => f.id === item.id);
  if (i >= 0) state.favorites.splice(i, 1);
  else state.favorites.unshift(item);
  persist();
  emit('favorites');
  return i < 0;
}

/* ————— سلسلة الأيام ————— */
export function touchStreak() {
  const todayISO = new Date().toISOString().slice(0, 10);
  const s = state.streak;
  if (s.lastDayISO === todayISO) return s;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  s.days = s.lastDayISO === yesterday ? s.days + 1 : 1;
  s.lastDayISO = todayISO;
  persist();
  emit('streak');
  return s;
}
