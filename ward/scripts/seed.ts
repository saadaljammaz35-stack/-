import './_env';
import { env } from '@/lib/env';
import { getDb } from '@/lib/db';
import { migrate } from '@/lib/db/migrate';
import { seed } from '@/lib/seed';

const e = env();
const db = await getDb();
await migrate(db);
const founder = e.WARD_FOUNDER_EMAIL && e.WARD_FOUNDER_PASSWORD ? { email: e.WARD_FOUNDER_EMAIL, password: e.WARD_FOUNDER_PASSWORD, name: e.WARD_FOUNDER_NAME } : null;
const result = await seed({ orgSlug: e.WARD_ORG_SLUG, founder });
console.info(`Organization ${result.orgId}`);
console.info(result.created.length ? `Created: ${result.created.join(', ')}` : 'Nothing new to seed.');
if (!founder) console.info('No founder account yet: run `npm run founder:create -- --email you@example.com --name "..."` (password is read from WARD_FOUNDER_PASSWORD or prompted).');
await db.close();
