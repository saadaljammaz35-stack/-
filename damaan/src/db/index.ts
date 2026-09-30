import * as SQLite from 'expo-sqlite';

const DATABASE_NAME = 'damaan.db';

/**
 * Schema migrations, applied in order. Each entry is one version step and runs
 * exactly once; `user_version` records how far the file has come. Never edit a
 * shipped migration — add the next one, or a released install cannot upgrade.
 */
const MIGRATIONS: ((db: SQLite.SQLiteDatabase) => Promise<void>)[] = [
  async (db) => {
    await db.execAsync(`
      CREATE TABLE receipts (
        id              TEXT PRIMARY KEY NOT NULL,
        merchant        TEXT NOT NULL,
        item            TEXT NOT NULL,
        category_id     TEXT NOT NULL,
        total_minor     INTEGER NOT NULL,
        purchase_date   TEXT NOT NULL,
        warranty_months INTEGER NOT NULL,
        return_days     INTEGER NOT NULL,
        exchange_days   INTEGER NOT NULL,
        serial          TEXT NOT NULL DEFAULT '',
        notes           TEXT NOT NULL DEFAULT '',
        images          TEXT NOT NULL DEFAULT '[]',
        created_at      TEXT NOT NULL,
        updated_at      TEXT NOT NULL
      );

      CREATE INDEX receipts_purchase_date ON receipts (purchase_date DESC);

      CREATE TABLE scheduled_reminders (
        id                TEXT PRIMARY KEY NOT NULL,
        receipt_id        TEXT NOT NULL REFERENCES receipts (id) ON DELETE CASCADE,
        kind              TEXT NOT NULL,
        fires_at          TEXT NOT NULL,
        notification_id   TEXT NOT NULL
      );

      CREATE INDEX scheduled_reminders_receipt ON scheduled_reminders (receipt_id);
    `);
  },
];

let connection: SQLite.SQLiteDatabase | null = null;

/**
 * Opens the database, bringing the schema up to date on first call. Foreign
 * keys are off by default in SQLite, so the cascade above needs the pragma.
 */
export async function database(): Promise<SQLite.SQLiteDatabase> {
  if (connection) return connection;

  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;

  for (let version = current; version < MIGRATIONS.length; version += 1) {
    const migrate = MIGRATIONS[version]!;
    await db.withTransactionAsync(async () => {
      await migrate(db);
    });
    // PRAGMA will not take a bound parameter, and `version` is a loop integer.
    await db.execAsync(`PRAGMA user_version = ${version + 1}`);
  }

  connection = db;
  return db;
}

/** Closes the connection. Used by the "erase everything" path in Settings. */
export async function closeDatabase(): Promise<void> {
  if (!connection) return;
  await connection.closeAsync();
  connection = null;
}

export { DATABASE_NAME };
