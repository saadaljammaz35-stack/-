import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Database } from '@/lib/db';

export const MIGRATIONS_DIR = path.join(/*turbopackIgnore: true*/ process.cwd(), 'supabase', 'migrations');

/**
 * Apply pending SQL migrations in filename order, each in its own transaction.
 * Compatible with the Supabase CLI layout (`supabase/migrations/<timestamp>_<name>.sql`):
 * use either this runner or `supabase db push`, not both, on the same database.
 */
export async function migrate(db: Database, dir = MIGRATIONS_DIR): Promise<string[]> {
  // Migrations are read at run time from the project folder (CLI, worker, or the embedded dev
  // database) and deliberately not traced into serverless bundles.
  const files = (await readdir(/*turbopackIgnore: true*/ dir)).filter((f) => f.endsWith('.sql')).sort();
  const applied = await db.system(async (q) => {
    await q.exec(
      `create schema if not exists ward;
       create table if not exists ward.schema_migrations (version text primary key, applied_at timestamptz not null default now());`,
    );
    return new Set((await q.query<{ version: string }>('select version from ward.schema_migrations')).map((r) => r.version));
  });

  const ran: string[] = [];
  for (const file of files) {
    const version = file.replace(/\.sql$/, '');
    if (applied.has(version)) continue;
    const sql = await readFile(/*turbopackIgnore: true*/ path.join(dir, file), 'utf8');
    await db.system(async (q) => {
      await q.exec(sql);
      await q.query('insert into ward.schema_migrations (version) values ($1)', [version]);
    });
    ran.push(version);
  }
  return ran;
}
