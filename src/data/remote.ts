// Online sources (Quran.com API) with an offline cache in the user database: anything
// fetched once keeps working without a connection.
import { getUserDb } from './db';

const QURAN_API = 'https://api.quran.com/api/v4';
const QDC_API = 'https://api.quran.com/api/qdc';

export class OfflineError extends Error {
  constructor() {
    super('offline');
  }
}

async function readCache<T>(key: string): Promise<{ body: T; savedAt: number } | null> {
  const db = await getUserDb();
  const r = await db.getFirstAsync<{ body: string; saved_at: number }>('SELECT body, saved_at FROM http_cache WHERE key = ?', key);
  return r ? { body: JSON.parse(r.body) as T, savedAt: r.saved_at } : null;
}

async function writeCache(key: string, body: unknown) {
  const db = await getUserDb();
  await db.runAsync('INSERT OR REPLACE INTO http_cache (key, body, saved_at) VALUES (?, ?, ?)', key, JSON.stringify(body), Date.now());
}

/** Fetches JSON, serving the cache when fresh enough or when the network fails. */
export async function cachedJson<T>(url: string, maxAgeMs = 30 * 86_400_000, timeoutMs = 15000): Promise<T> {
  const cached = await readCache<T>(url);
  if (cached && Date.now() - cached.savedAt < maxAgeMs) return cached.body;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json' } });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as T;
    await writeCache(url, body);
    return body;
  } catch (err) {
    if (cached) return cached.body;
    throw err instanceof TypeError || (err as Error).name === 'AbortError' ? new OfflineError() : err;
  }
}

// ---------- Recitations ----------

export type Reciter = { id: number; name: string; style: string };

// Reciters with verse-by-verse timings on Quran.com (QDC). Shown offline; refreshed online.
export const RECITERS: Reciter[] = [
  { id: 97, name: 'ياسر الدوسري', style: 'مرتل' },
  { id: 7, name: 'مشاري راشد العفاسي', style: 'مرتل' },
  { id: 3, name: 'عبد الرحمن السديس', style: 'مرتل' },
  { id: 10, name: 'سعود الشريم', style: 'مرتل' },
  { id: 6, name: 'محمود خليل الحصري', style: 'مرتل' },
  { id: 12, name: 'محمود خليل الحصري', style: 'معلّم' },
  { id: 9, name: 'محمد صديق المنشاوي', style: 'مرتل' },
  { id: 2, name: 'عبد الباسط عبد الصمد', style: 'مرتل' },
  { id: 1, name: 'عبد الباسط عبد الصمد', style: 'مجوّد' },
  { id: 4, name: 'أبو بكر الشاطري', style: 'مرتل' },
  { id: 5, name: 'هاني الرفاعي', style: 'مرتل' },
  { id: 161, name: 'خليفة الطنيجي', style: 'مرتل' },
];

/** Word segments are [word position in the verse, from ms, to ms]; a reciter may repeat a word. */
export type VerseTiming = { ayah: number; from: number; to: number; words: [number, number, number][] };
export type ChapterAudio = { url: string; durationMs: number; sizeBytes: number; timings: VerseTiming[] };

type QdcAudioResponse = {
  audio_files: {
    audio_url: string;
    duration: number;
    file_size: number;
    verse_timings: { verse_key: string; timestamp_from: number; timestamp_to: number; segments?: number[][] }[];
  }[];
};

export async function getChapterAudio(reciterId: number, surah: number): Promise<ChapterAudio> {
  const body = await cachedJson<QdcAudioResponse>(
    `${QDC_API}/audio/reciters/${reciterId}/audio_files?chapter=${surah}&segments=true`,
    365 * 86_400_000,
  );
  const f = body.audio_files[0];
  if (!f) throw new Error('no audio for this surah');
  return {
    url: f.audio_url,
    durationMs: f.duration,
    sizeBytes: f.file_size,
    timings: f.verse_timings.map((t) => ({
      ayah: Number(t.verse_key.split(':')[1]),
      from: t.timestamp_from,
      to: t.timestamp_to,
      // A few recordings carry malformed entries; keep only complete [position, from, to] triples.
      words: (t.segments ?? [])
        .filter((s): s is [number, number, number] => s.length === 3 && s.every(Number.isFinite) && s[2] > s[1])
        .sort((a, b) => a[1] - b[1]),
    })),
  };
}

// ---------- Tafsir (online editions) ----------

export type OnlineTafsir = { id: number; name: string; author: string };

export const ONLINE_TAFSIRS: OnlineTafsir[] = [
  { id: 14, name: 'تفسير ابن كثير', author: 'الحافظ ابن كثير' },
  { id: 15, name: 'تفسير الطبري', author: 'ابن جرير الطبري' },
  { id: 90, name: 'تفسير القرطبي', author: 'أبو عبد الله القرطبي' },
  { id: 94, name: 'تفسير البغوي', author: 'الحسين بن مسعود البغوي' },
  { id: 93, name: 'التفسير الوسيط', author: 'محمد سيد طنطاوي' },
];

export function cleanHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim();
}

export async function getOnlineTafsir(tafsirId: number, surah: number, ayah: number): Promise<string> {
  const body = await cachedJson<{ tafsir: { text: string } }>(`${QURAN_API}/tafsirs/${tafsirId}/by_ayah/${surah}:${ayah}`);
  return cleanHtml(body.tafsir?.text ?? '');
}

// ---------- Translations of the meanings ----------

export type TranslationInfo = { id: number; name: string; author: string; language: string };

export const TRANSLATIONS: TranslationInfo[] = [
  { id: 20, name: 'Saheeh International', author: 'Saheeh International', language: 'English' },
  { id: 85, name: 'Abdul Haleem', author: 'M.A.S. Abdel Haleem', language: 'English' },
  { id: 31, name: 'Muhammad Hamidullah', author: 'Muhammad Hamidullah', language: 'Français' },
  { id: 33, name: 'Terjemahan Kemenag', author: 'Indonesian Islamic Affairs Ministry', language: 'Indonesia' },
  { id: 134, name: 'King Fahad Quran Complex', author: 'مجمع الملك فهد', language: 'Indonesia' },
  { id: 39, name: 'Abdullah Muhammad Basmeih', author: 'Abdullah Muhammad Basmeih', language: 'Melayu' },
  { id: 77, name: 'Diyanet İşleri', author: 'Diyanet İşleri', language: 'Türkçe' },
  { id: 234, name: 'فتح محمد جالندھری', author: 'Fatah Muhammad Jalandhari', language: 'اردو' },
  { id: 97, name: 'تفہیم القرآن', author: 'Abul A’la Maududi', language: 'اردو' },
  { id: 161, name: 'Taisirul Quran', author: 'Tawheed Publication', language: 'বাংলা' },
  { id: 27, name: 'Bubenheim & Elyas', author: 'Frank Bubenheim and Nadeem', language: 'Deutsch' },
  { id: 83, name: 'Isa García', author: 'Sheikh Isa Garcia', language: 'Español' },
  { id: 45, name: 'Эльмир Кулиев', author: 'Elmir Kuliev', language: 'Русский' },
];

export async function getPageTranslation(translationId: number, page: number): Promise<Map<string, string>> {
  const body = await cachedJson<{ verses: { verse_key: string; translations: { text: string }[] }[] }>(
    `${QURAN_API}/verses/by_page/${page}?translations=${translationId}&fields=verse_key&per_page=50`,
    365 * 86_400_000,
  );
  return new Map(body.verses.map((v) => [v.verse_key, cleanHtml(v.translations[0]?.text ?? '').replace(/\d+$/, '')]));
}

export async function getVerseTranslation(translationId: number, surah: number, ayah: number): Promise<string> {
  const body = await cachedJson<{ translations: { text: string }[] }>(
    `${QURAN_API}/quran/translations/${translationId}?verse_key=${surah}:${ayah}`,
    365 * 86_400_000,
  );
  return cleanHtml(body.translations[0]?.text ?? '');
}
