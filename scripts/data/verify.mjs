// Integrity checks over the committed content, run in CI (npm run data:verify).
import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { verifyHadithBooks } from './hadith-books.mjs';
import { ROOT, assert, log, readJson } from './lib.mjs';

const verses = readJson('quran/verses.json');
const layout = readJson('quran/layout.json');
assert(verses.length === 6236, 'verse count');
assert(layout.length === 604, 'page count');
layout.forEach((lines, i) => assert(i < 2 || lines.length === 15, `page ${i + 1} has ${lines.length} lines`));
const seen = new Set();
for (const lines of layout) for (const l of lines) for (const w of l.w ?? []) if (w[2]) seen.add(w[0]);
assert(seen.size === 6236, 'every verse needs exactly one end marker in the layout');
log('quran ok');

const hisn = readJson('adhkar/hisn.json');
const items = hisn.chapters.flatMap((c) => c.items);
assert(items.length === 267, 'Hisn al-Muslim has 267 numbered items');
assert(items.every((i) => i.footnotes.length > 0 && i.audio), 'each dhikr needs its takhrij and audio');
log('adhkar ok');

const names = readJson('names/asma-ul-husna.json');
assert(names.names.length === 99 && names.names.every((n) => n.explanation), 'names');
log('names ok');

const dbFile = join(ROOT, 'assets/db/content.db');
assert(existsSync(dbFile), 'run npm run data:build');
const db = new DatabaseSync(dbFile, { readOnly: true });
const count = (t) => db.prepare(`SELECT COUNT(*) c FROM ${t}`).get().c;
assert(count('verses') === 6236 && count('surahs') === 114 && count('names') === 99, 'database counts');
db.close();
log('content.db ok');

log('hadith books verified:', await verifyHadithBooks());
