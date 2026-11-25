import './_env';
import { getDb } from '@/lib/db';
import { migrate } from '@/lib/db/migrate';

const db = await getDb();
const ran = await migrate(db);
console.info(ran.length ? `Applied: ${ran.join(', ')}` : 'Database is up to date.');
await db.close();
