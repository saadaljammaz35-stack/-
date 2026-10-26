// Opens the bundled content database (copied from the app bundle on first launch or when a
// new version ships) and the user's writable database (downloaded hadith books).
import * as SQLite from 'expo-sqlite';

import { kvStorage } from '@/store/storage';

import manifest from './db-manifest.json';

const CONTENT_ASSET = require('../../assets/db/content.db');
const CONTENT_VERSION_KEY = 'maallah:content-db-version';

let contentPromise: Promise<SQLite.SQLiteDatabase> | null = null;
let userPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function contentDbName(): string {
  return `content-${manifest['content.db'].version}.db`;
}

async function openContent(): Promise<SQLite.SQLiteDatabase> {
  const name = contentDbName();
  const previous = kvStorage.getItem(CONTENT_VERSION_KEY) as string | null;
  await SQLite.importDatabaseFromAssetAsync(name, { assetId: CONTENT_ASSET });
  const db = await SQLite.openDatabaseAsync(name);
  if (previous && previous !== name) {
    // A newer app version shipped new content: drop the old copy.
    await SQLite.deleteDatabaseAsync(previous).catch(() => undefined);
  }
  kvStorage.setItem(CONTENT_VERSION_KEY, name);
  return db;
}

export function getContentDb(): Promise<SQLite.SQLiteDatabase> {
  if (!contentPromise) {
    contentPromise = openContent().catch((err) => {
      contentPromise = null;
      throw err;
    });
  }
  return contentPromise;
}

const USER_SCHEMA = `
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS hadith_books (id TEXT PRIMARY KEY, name TEXT, author TEXT, total INTEGER,
    sha256 TEXT, installed_at INTEGER);
  CREATE TABLE IF NOT EXISTS hadith_sections (book TEXT, id INTEGER, title TEXT, title_en TEXT, first REAL,
    count INTEGER, PRIMARY KEY (book, id));
  CREATE TABLE IF NOT EXISTS hadiths (id INTEGER PRIMARY KEY AUTOINCREMENT, book TEXT, n REAL, display TEXT,
    section INTEGER, text TEXT, text_search TEXT, grades TEXT);
  CREATE INDEX IF NOT EXISTS hadiths_book ON hadiths(book, n);
  CREATE INDEX IF NOT EXISTS hadiths_section ON hadiths(book, section, n);
  CREATE TABLE IF NOT EXISTS http_cache (key TEXT PRIMARY KEY, body TEXT, saved_at INTEGER);
`;

export function getUserDb(): Promise<SQLite.SQLiteDatabase> {
  if (!userPromise) {
    userPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('user.db');
      await db.execAsync(USER_SCHEMA);
      return db;
    })().catch((err) => {
      userPromise = null;
      throw err;
    });
  }
  return userPromise;
}

/** Escapes LIKE wildcards in user input. */
export function likePattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** Deletes downloaded hadith books and cached online responses (tafsir, translations, audio timings). */
export async function clearUserContent(): Promise<void> {
  const db = await getUserDb();
  await db.execAsync('DELETE FROM hadiths; DELETE FROM hadith_sections; DELETE FROM hadith_books; DELETE FROM http_cache; VACUUM;');
}
