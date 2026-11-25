import './_env';
import { parseArgs } from 'node:util';
import { createInterface } from 'node:readline/promises';
import { env } from '@/lib/env';
import { getDb } from '@/lib/db';
import { migrate } from '@/lib/db/migrate';
import { seed } from '@/lib/seed';
import { PASSWORD_MIN_LENGTH } from '@/lib/auth/password';

const { values } = parseArgs({ options: { email: { type: 'string' }, name: { type: 'string' } } });
const e = env();
const email = values.email ?? e.WARD_FOUNDER_EMAIL;
if (!email) throw new Error('Pass --email or set WARD_FOUNDER_EMAIL');
let password = e.WARD_FOUNDER_PASSWORD;
if (!password) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  password = await rl.question(`Founder password (min ${PASSWORD_MIN_LENGTH} chars): `);
  rl.close();
}
if (!password || password.length < PASSWORD_MIN_LENGTH) throw new Error(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
const db = await getDb();
await migrate(db);
const result = await seed({ orgSlug: e.WARD_ORG_SLUG, founder: { email, password, name: values.name ?? e.WARD_FOUNDER_NAME } });
console.info(`Founder ${email} is the owner of organization ${result.orgId}.`);
await db.close();
