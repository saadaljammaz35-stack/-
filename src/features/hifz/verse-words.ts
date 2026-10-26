import { getPageLines, getSurahs, type Verse } from '@/data/content';

export type VerseWords = { words: { text: string; position: number }[]; end: string };

/** A verse's written words (with their timing positions) and its end marker, from the page layout. */
export async function getVerseWords(verse: Verse): Promise<VerseWords> {
  const words: VerseWords['words'] = [];
  let end = '';
  // A verse can run on to the next page.
  for (const page of [verse.page, verse.page + 1]) {
    if (page > 604) break;
    for (const line of await getPageLines(page)) {
      if (line.type !== 'ayah') continue;
      for (const [id, text, isEnd, position] of line.words) {
        if (id !== verse.id) continue;
        if (isEnd) end = text;
        else words.push({ text, position });
      }
    }
    if (end) break;
  }
  return { words, end };
}

/** First verse id of each surah (index 0 = surah 1), from the surah verse counts. */
export async function surahStarts(): Promise<number[]> {
  const surahs = await getSurahs();
  const starts: number[] = [];
  let id = 0;
  for (const s of surahs) {
    starts.push(id);
    id += s.versesCount;
  }
  return starts;
}

/** Surah number (1–114) of a verse id. */
export function surahOfVerse(starts: number[], verseId: number): number {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= verseId) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}
