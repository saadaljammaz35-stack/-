// Hadith collections in the user database. The two small collections ship inside the app;
// the large ones are downloaded once, verified (SHA-256 and reference checks) and stored.
import { CryptoDigestAlgorithm, digest } from 'expo-crypto';

import { getUserDb, likePattern } from '@/data/db';
import { normalizeArabic } from '@/lib/arabic';
import type { HadithGrade } from '@/lib/hadith-grades';
import { failedReferenceChecks, processEdition, type RawEdition } from '@/lib/hadith-import';

import booksMeta from '../../../data/hadith/books.json';
import muslimNumbers from '../../../data/hadith/muslim-numbers.json';

export type BookMeta = (typeof booksMeta.books)[number];
export const BOOKS: BookMeta[] = booksMeta.books;

export type InstalledBook = { id: string; name: string; author: string; total: number; installedAt: number };
export type Section = { book: string; id: number; title: string; count: number };
export type Hadith = { id: number; book: string; n: number; display: string; section: number; text: string; grades: HadithGrade[] };

export class IntegrityError extends Error {}

const BUNDLED: Record<string, () => RawEdition> = {
  nawawi: () => require('../../../data/hadith/bundled/nawawi.json') as RawEdition,
  qudsi: () => require('../../../data/hadith/bundled/qudsi.json') as RawEdition,
};

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function installedBooks(): Promise<InstalledBook[]> {
  const db = await getUserDb();
  const rows = await db.getAllAsync<{ id: string; name: string; author: string; total: number; installed_at: number }>(
    'SELECT id, name, author, total, installed_at FROM hadith_books',
  );
  const order = BOOKS.map((b) => b.id);
  return rows
    .map((r) => ({ id: r.id, name: r.name, author: r.author, total: r.total, installedAt: r.installed_at }))
    .sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
}

async function store(meta: BookMeta, raw: RawEdition, onProgress?: (p: number) => void) {
  const { rows } = processEdition(raw, meta.id === 'muslim' ? (muslimNumbers as Record<string, number | null>) : undefined);
  const failures = failedReferenceChecks(meta.id, rows);
  if (failures.length) throw new IntegrityError(failures.join('; '));
  if (rows.length !== meta.count) throw new IntegrityError(`expected ${meta.count} hadiths, got ${rows.length}`);
  const db = await getUserDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM hadiths WHERE book = ?', meta.id);
    await db.runAsync('DELETE FROM hadith_sections WHERE book = ?', meta.id);
    const stmt = await db.prepareAsync(
      'INSERT INTO hadiths (book, n, display, section, text, text_search, grades) VALUES (?, ?, ?, ?, ?, ?, ?)',
    );
    try {
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        await stmt.executeAsync(meta.id, r.n, r.display, r.section, r.text, r.search, JSON.stringify(r.grades));
        if (onProgress && i % 250 === 0) onProgress(0.5 + (i / rows.length) * 0.5);
      }
    } finally {
      await stmt.finalizeAsync();
    }
    for (const s of meta.sections) {
      await db.runAsync(
        'INSERT INTO hadith_sections (book, id, title, title_en, first, count) VALUES (?, ?, ?, ?, ?, ?)',
        meta.id,
        s.id,
        s.title,
        s.titleEn,
        s.first,
        s.count,
      );
    }
    await db.runAsync(
      'INSERT OR REPLACE INTO hadith_books (id, name, author, total, sha256, installed_at) VALUES (?, ?, ?, ?, ?, ?)',
      meta.id,
      meta.name,
      meta.author,
      rows.length,
      meta.sha256,
      Date.now(),
    );
  });
  onProgress?.(1);
}

/** Imports the collections bundled with the app (Forty Nawawi, Forty Qudsi) once. */
export async function ensureBundledBooks(): Promise<void> {
  const installed = new Set((await installedBooks()).map((b) => b.id));
  for (const meta of BOOKS.filter((b) => b.bundled && !installed.has(b.id))) {
    await store(meta, BUNDLED[meta.id]());
  }
}

/** Downloads, verifies and installs one of the large collections. */
export async function installBook(id: string, onProgress?: (p: number) => void): Promise<void> {
  const meta = BOOKS.find((b) => b.id === id);
  if (!meta) throw new Error(`unknown book ${id}`);
  if (meta.bundled) return store(meta, BUNDLED[meta.id](), onProgress);
  let buffer: ArrayBuffer | null = null;
  let lastError: unknown = null;
  for (const url of [meta.url, meta.mirror]) {
    try {
      onProgress?.(0.05);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      buffer = await res.arrayBuffer();
      break;
    } catch (err) {
      lastError = err;
    }
  }
  if (!buffer) throw lastError ?? new Error('download failed');
  onProgress?.(0.35);
  const hash = toHex(await digest(CryptoDigestAlgorithm.SHA256, new Uint8Array(buffer)));
  if (hash !== meta.sha256) throw new IntegrityError('checksum mismatch');
  const raw = JSON.parse(new TextDecoder('utf-8').decode(buffer)) as RawEdition;
  onProgress?.(0.5);
  await store(meta, raw, onProgress);
}

export async function removeBook(id: string): Promise<void> {
  const db = await getUserDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM hadiths WHERE book = ?', id);
    await db.runAsync('DELETE FROM hadith_sections WHERE book = ?', id);
    await db.runAsync('DELETE FROM hadith_books WHERE id = ?', id);
  });
}

export async function getSections(book: string): Promise<Section[]> {
  const db = await getUserDb();
  return db.getAllAsync<Section>('SELECT book, id, title, count FROM hadith_sections WHERE book = ? ORDER BY first, id', book);
}

type HadithRow = { id: number; book: string; n: number; display: string; section: number; text: string; grades: string };
const toHadith = (r: HadithRow): Hadith => ({ ...r, grades: JSON.parse(r.grades) as HadithGrade[] });

export async function getSectionHadiths(book: string, section: number, limit = 40, offset = 0): Promise<Hadith[]> {
  const db = await getUserDb();
  const rows = await db.getAllAsync<HadithRow>(
    'SELECT id, book, n, display, section, text, grades FROM hadiths WHERE book = ? AND section = ? ORDER BY n LIMIT ? OFFSET ?',
    book,
    section,
    limit,
    offset,
  );
  return rows.map(toHadith);
}

export async function getHadith(book: string, n: number): Promise<Hadith | null> {
  const db = await getUserDb();
  const r = await db.getFirstAsync<HadithRow>(
    'SELECT id, book, n, display, section, text, grades FROM hadiths WHERE book = ? AND n = ?',
    book,
    n,
  );
  return r ? toHadith(r) : null;
}

export async function findByNumber(book: string, display: string): Promise<Hadith | null> {
  const db = await getUserDb();
  const r = await db.getFirstAsync<HadithRow>(
    'SELECT id, book, n, display, section, text, grades FROM hadiths WHERE book = ? AND display = ? ORDER BY n LIMIT 1',
    book,
    display,
  );
  return r ? toHadith(r) : null;
}

export async function searchHadiths(query: string, books: string[] | null, limit = 100): Promise<Hadith[]> {
  const q = normalizeArabic(query);
  if (q.length < 2) return [];
  const db = await getUserDb();
  const filter = books && books.length ? `AND book IN (${books.map(() => '?').join(',')})` : '';
  const rows = await db.getAllAsync<HadithRow>(
    `SELECT id, book, n, display, section, text, grades FROM hadiths
     WHERE text_search LIKE ? ESCAPE '\\' ${filter} ORDER BY id LIMIT ?`,
    likePattern(q),
    ...(books ?? []),
    limit,
  );
  return rows.map(toHadith);
}

export function bookName(id: string): string {
  return BOOKS.find((b) => b.id === id)?.name ?? id;
}

/** «رواه البخاري (1)» style citation. */
export function citation(h: Pick<Hadith, 'book' | 'display'>): string {
  const label: Record<string, string> = {
    bukhari: 'صحيح البخاري',
    muslim: 'صحيح مسلم',
    abudawud: 'سنن أبي داود',
    tirmidhi: 'جامع الترمذي',
    nasai: 'سنن النسائي',
    ibnmajah: 'سنن ابن ماجه',
    malik: 'موطأ مالك',
    nawawi: 'الأربعون النووية',
    qudsi: 'الأحاديث القدسية',
  };
  return `${label[h.book] ?? h.book} (${h.display})`;
}
