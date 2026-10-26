// Builds the bundled content database after `npm install` when it is missing or stale.
// assets/db/ is not committed; the database is generated from the verified files in data/.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './lib.mjs';

const [major, minor] = process.versions.node.split('.').map(Number);
const file = join(ROOT, 'assets/db/content.db');
const manifest = JSON.parse(readFileSync(join(ROOT, 'src/data/db-manifest.json'), 'utf8'))['content.db'];
const current = existsSync(file) && createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 12) === manifest.version;

if (current) process.exit(0);
if (major < 22 || (major === 22 && minor < 5)) {
  console.warn(`[data] Node ${process.versions.node} cannot build assets/db/content.db (needs 22.5+). Run "npm run data:build" with a newer Node.`);
  process.exit(0);
}
execFileSync(process.execPath, [join(ROOT, 'scripts/data/build-db.mjs')], { stdio: 'inherit' });
