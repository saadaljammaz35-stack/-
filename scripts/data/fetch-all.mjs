// Re-fetches every content source (cached under .data-cache/) and rebuilds the database.
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { ROOT } from './lib.mjs';

const steps = [
  'fetch-quran.mjs',
  'fetch-tafsir.mjs',
  'fetch-adhkar.mjs',
  'fetch-hadith.mjs',
  'fetch-hadeethenc.mjs',
  'fetch-names.mjs',
  'fetch-asbab.mjs',
  'fetch-cities.mjs',
  'build-db.mjs',
];
for (const step of steps) {
  console.log(`\n▶ ${step}`);
  execFileSync(process.execPath, [join(ROOT, 'scripts/data', step)], { stdio: 'inherit' });
}
