import { parseTimestamp } from '@/lib/format';
import type { Chapter } from '@/lib/types';

export interface ParseResult<T> {
  items: T[];
  errors: { line: number; text: string }[];
}

/**
 * Parses chapters written one per line, e.g.
 *   00:00 مقدمة
 *   12:30 - البداية | The beginning
 * An optional English title follows a "|" separator.
 */
export function parseChapters(input: string): ParseResult<Chapter> {
  const items: Chapter[] = [];
  const errors: ParseResult<Chapter>['errors'] = [];
  input.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    if (!line) return;
    const match = /^(\d{1,2}(?::\d{1,2}){1,2})\s*[-–—:]?\s*(.+)$/.exec(line);
    const seconds = match ? parseTimestamp(match[1]) : null;
    if (!match || seconds === null || !match[2]) {
      errors.push({ line: index + 1, text: line });
      return;
    }
    const [title, titleEn] = match[2].split('|').map((part) => part.trim());
    if (!title) {
      errors.push({ line: index + 1, text: line });
      return;
    }
    items.push({ startSeconds: seconds, title: title.slice(0, 200), titleEn: titleEn ? titleEn.slice(0, 200) : null });
  });
  const unique = new Map<number, Chapter>();
  for (const chapter of items) unique.set(chapter.startSeconds, chapter);
  return { items: [...unique.values()].sort((a, b) => a.startSeconds - b.startSeconds), errors };
}

export function chaptersToText(chapters: Chapter[]): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return chapters
    .map((c) => {
      const h = Math.floor(c.startSeconds / 3600);
      const m = Math.floor((c.startSeconds % 3600) / 60);
      const s = c.startSeconds % 60;
      const stamp = h ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
      return `${stamp} ${c.title}${c.titleEn ? ` | ${c.titleEn}` : ''}`;
    })
    .join('\n');
}

/** Index of the chapter playing at `time`, or -1 before the first chapter. */
export function chapterIndexAt(chapters: Chapter[], time: number): number {
  let index = -1;
  for (let i = 0; i < chapters.length; i++) {
    if ((chapters[i]?.startSeconds ?? Infinity) <= time) index = i;
    else break;
  }
  return index;
}
