import * as SQLite from 'expo-sqlite';

import type { DocumentStore, Row, TableName } from './types';

/**
 * Native store: one SQLite table of JSON documents keyed by (table, id).
 * The database file lives in the app's private sandbox.
 */
export class SQLiteStore implements DocumentStore {
  private db: SQLite.SQLiteDatabase | null = null;

  constructor(private name = 'mahallak.db') {}

  async init(): Promise<void> {
    if (this.db) return;
    this.db = await SQLite.openDatabaseAsync(this.name);
    await this.db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS docs (
        tbl TEXT NOT NULL,
        id TEXT NOT NULL,
        data TEXT NOT NULL,
        PRIMARY KEY (tbl, id)
      );
    `);
  }

  private get conn(): SQLite.SQLiteDatabase {
    if (!this.db) throw new Error('SQLiteStore used before init()');
    return this.db;
  }

  async all<T extends Row>(table: TableName): Promise<T[]> {
    const rows = await this.conn.getAllAsync<{ data: string }>('SELECT data FROM docs WHERE tbl = ?', table);
    return rows.map((r) => JSON.parse(r.data) as T);
  }

  async get<T extends Row>(table: TableName, id: string): Promise<T | null> {
    const row = await this.conn.getFirstAsync<{ data: string }>('SELECT data FROM docs WHERE tbl = ? AND id = ?', table, id);
    return row ? (JSON.parse(row.data) as T) : null;
  }

  async put<T extends Row>(table: TableName, row: T): Promise<void> {
    await this.conn.runAsync('INSERT OR REPLACE INTO docs (tbl, id, data) VALUES (?, ?, ?)', table, row.id, JSON.stringify(row));
  }

  async putMany<T extends Row>(table: TableName, rows: T[]): Promise<void> {
    await this.conn.withTransactionAsync(async () => {
      for (const r of rows) await this.put(table, r);
    });
  }

  async remove(table: TableName, id: string): Promise<void> {
    await this.conn.runAsync('DELETE FROM docs WHERE tbl = ? AND id = ?', table, id);
  }

  async clear(table?: TableName): Promise<void> {
    if (table) await this.conn.runAsync('DELETE FROM docs WHERE tbl = ?', table);
    else await this.conn.runAsync('DELETE FROM docs');
  }

  async transaction(fn: () => Promise<void>): Promise<void> {
    await this.conn.withTransactionAsync(fn);
  }
}
