// Turns a raw «hadith-api» edition file into database rows and proves its numbering
// against well-known references. Used by the data pipeline (Node) and by the app when a
// book is downloaded, so both run exactly the same checks.
import { normalizeArabic } from './arabic.ts';
import { translateGrades, type HadithGrade } from './hadith-grades.ts';

export type RawHadith = {
  hadithnumber: number;
  text: string;
  grades?: { name: string; grade: string }[];
  reference?: { book: number; hadith: number };
};

export type RawEdition = { metadata?: { name?: string }; hadiths: RawHadith[] };

export type HadithRow = {
  n: number;
  display: string;
  section: number;
  text: string;
  search: string;
  grades: HadithGrade[];
};

export type ReferenceCheck = { book: string; number?: number; display?: string; contains: string };

// Well-known references used to prove the numbering matches the printed editions.
export const REFERENCE_CHECKS: ReferenceCheck[] = [
  { book: 'bukhari', number: 1, contains: 'انما الاعمال بالنيات' },
  { book: 'muslim', display: '8', contains: 'شديد بياض الثياب' },
  { book: 'muslim', display: '2699', contains: 'من نفس عن مومن كربه' },
  { book: 'tirmidhi', number: 2516, contains: 'احفظ الله يحفظك' },
  { book: 'abudawud', number: 4607, contains: 'عليكم بسنتي' },
  { book: 'ibnmajah', number: 224, contains: 'طلب العلم فريضه' },
  { book: 'nasai', number: 1, contains: 'اذا استيقظ احدكم من نومه' },
  { book: 'malik', number: 1, contains: 'ان عمر بن عبد العزيز اخر الصلاه يوما' },
  { book: 'nawawi', number: 1, contains: 'انما الاعمال بالنيات' },
];

/**
 * Converts the raw edition into rows. Entries without text are numbers that the edition
 * merged into a neighbouring hadith; they are skipped and counted.
 * `abdAlBaqi` maps Sahih Muslim's sequential numbers to Muhammad Fuad Abd al-Baqi's numbering.
 */
export function processEdition(
  raw: RawEdition,
  abdAlBaqi?: Record<string, number | null>,
): { rows: HadithRow[]; skippedEmpty: number } {
  const rows: HadithRow[] = [];
  let skippedEmpty = 0;
  for (const h of raw.hadiths) {
    const text = h.text.replace(/\s+/g, ' ').trim();
    if (!text) {
      skippedEmpty++;
      continue;
    }
    let display = String(h.hadithnumber);
    if (abdAlBaqi) {
      const n = abdAlBaqi[String(h.hadithnumber)];
      display = n ? String(Math.trunc(n)) : `المقدمة ${h.hadithnumber}`;
    }
    rows.push({
      n: h.hadithnumber,
      display,
      section: h.reference?.book ?? 0,
      text,
      search: normalizeArabic(text),
      grades: translateGrades(h.grades),
    });
  }
  return { rows, skippedEmpty };
}

/** Returns the list of failed checks for this book (empty when everything matches). */
export function failedReferenceChecks(bookId: string, rows: HadithRow[]): string[] {
  const failures: string[] = [];
  for (const check of REFERENCE_CHECKS.filter((c) => c.book === bookId)) {
    const label = `${bookId} ${check.display ?? check.number}`;
    const row = check.display
      ? rows.find((r) => r.display === check.display)
      : rows.find((r) => r.n === check.number);
    if (!row) failures.push(`${label}: missing`);
    else if (!row.search.includes(check.contains)) failures.push(`${label}: text mismatch`);
  }
  return failures;
}
