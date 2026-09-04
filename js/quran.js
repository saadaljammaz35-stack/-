/**
 * القرآن الكريم — قراءة صفحة/سورة عبر واجهة alquran.cloud مع تخزين محلي للقراءة دون إنترنت.
 */
import { SURAHS, TOTAL_PAGES } from '../data/surahs.js';

const API = 'https://api.alquran.cloud/v1';
const EDITION = 'quran-uthmani';
const CACHE_KEY = 'maa-allah:quran-cache:v1';
const MAX_CACHED_PAGES = 80;

function readCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); }
  catch { return {}; }
}

function writeCache(cache) {
  try {
    const keys = Object.keys(cache);
    if (keys.length > MAX_CACHED_PAGES) {
      // نحذف الأقدم
      keys.sort((a, b) => (cache[a].at || 0) - (cache[b].at || 0));
      for (const k of keys.slice(0, keys.length - MAX_CACHED_PAGES)) delete cache[k];
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch { /* المساحة ممتلئة — نتجاهل */ }
}

/** المصدر الأول: alquran.cloud */
async function fromAlquranCloud(p) {
  const res = await fetch(`${API}/page/${p}/${EDITION}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const json = await res.json();
  const ayahs = (json.data?.ayahs || []).map((a) => ({
    number: a.numberInSurah,
    text: a.text,
    surah: a.surah?.number,
    surahName: a.surah?.name?.replace('سورة ', '') || SURAHS[(a.surah?.number || 1) - 1]?.name || '',
    sajda: !!a.sajda
  }));
  if (!ayahs.length) throw new Error('صفحة فارغة');
  return ayahs;
}

/** المصدر البديل: quran.com — يُستخدم إذا تعذّر الأول */
async function fromQuranCom(p) {
  const res = await fetch(
    `https://api.quran.com/api/v4/quran/verses/uthmani?page_number=${p}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const json = await res.json();
  const ayahs = (json.verses || []).map((v) => {
    const [s, n] = String(v.verse_key).split(':').map(Number);
    return {
      number: n, text: v.text_uthmani, surah: s,
      surahName: SURAHS[s - 1]?.name || '', sajda: false
    };
  });
  if (!ayahs.length) throw new Error('صفحة فارغة');
  return ayahs;
}

/**
 * جلب صفحة من المصحف (١..٦٠٤): المخزّن المحلي أولًا عند انقطاع الشبكة،
 * ومصدران على الإنترنت لضمان الوصول.
 * @returns {Promise<{page:number, ayahs:Array, offline:boolean}>}
 */
export async function fetchPage(page) {
  const p = Math.max(1, Math.min(TOTAL_PAGES, Math.round(page)));
  const cache = readCache();
  const hit = cache['p' + p];

  for (const source of [fromAlquranCloud, fromQuranCom]) {
    try {
      const ayahs = await source(p);
      const data = { page: p, ayahs, at: Date.now() };
      cache['p' + p] = data;
      writeCache(cache);
      return { ...data, offline: false };
    } catch { /* نجرّب المصدر التالي */ }
  }

  if (hit) return { ...hit, offline: true };
  throw new Error('تعذّر تحميل الصفحة، ولا توجد نسخة محفوظة. تأكّد من الاتصال بالإنترنت ثم أعد المحاولة.');
}

/** تحميل مسبق لعدد من الصفحات لقراءتها دون إنترنت */
export async function prefetchPages(from, count, onProgress) {
  let ok = 0;
  for (let i = 0; i < count; i++) {
    const p = from + i;
    if (p > TOTAL_PAGES) break;
    try { await fetchPage(p); ok++; } catch { /* نتجاوز */ }
    onProgress?.(i + 1, count, ok);
  }
  return ok;
}

export function cachedPagesCount() {
  return Object.keys(readCache()).length;
}

export function clearQuranCache() {
  try { localStorage.removeItem(CACHE_KEY); } catch { /* تجاهل */ }
}

/** روابط التلاوة الصوتية لصفحة (مشاري العفاسي افتراضيًّا) */
export const RECITERS = {
  alafasy: { name: 'مشاري راشد العفاسي', id: 'ar.alafasy' },
  sudais: { name: 'عبدالرحمن السديس', id: 'ar.abdurrahmaansudais' },
  shuraim: { name: 'سعود الشريم', id: 'ar.saoodshuraym' },
  husary: { name: 'محمود خليل الحصري', id: 'ar.husary' },
  minshawi: { name: 'محمد صديق المنشاوي', id: 'ar.minshawi' },
  abdulbasit: { name: 'عبدالباسط عبدالصمد', id: 'ar.abdulbasitmurattal' }
};

export function ayahAudioUrl(globalAyahNumber, reciterKey = 'alafasy') {
  const r = RECITERS[reciterKey] || RECITERS.alafasy;
  return `https://cdn.islamic.network/quran/audio/128/${r.id}/${globalAyahNumber}.mp3`;
}

export { SURAHS, TOTAL_PAGES };
