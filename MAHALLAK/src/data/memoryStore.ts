import type { DocumentStore, Row, TableName } from './types';

/** In-memory store for tests. Optionally backed by a serializer to simulate app restarts. */
export class MemoryStore implements DocumentStore {
  private tables = new Map<TableName, Map<string, string>>();

  constructor(snapshot?: string) {
    if (snapshot) {
      const parsed = JSON.parse(snapshot) as Record<string, Record<string, string>>;
      for (const [t, rows] of Object.entries(parsed)) this.tables.set(t as TableName, new Map(Object.entries(rows)));
    }
  }

  async init(): Promise<void> {}

  private table(name: TableName): Map<string, string> {
    let t = this.tables.get(name);
    if (!t) {
      t = new Map();
      this.tables.set(name, t);
    }
    return t;
  }

  async all<T extends Row>(table: TableName): Promise<T[]> {
    return [...this.table(table).values()].map((v) => JSON.parse(v) as T);
  }

  async get<T extends Row>(table: TableName, id: string): Promise<T | null> {
    const v = this.table(table).get(id);
    return v ? (JSON.parse(v) as T) : null;
  }

  async put<T extends Row>(table: TableName, row: T): Promise<void> {
    this.table(table).set(row.id, JSON.stringify(row));
  }

  async putMany<T extends Row>(table: TableName, rows: T[]): Promise<void> {
    for (const r of rows) await this.put(table, r);
  }

  async remove(table: TableName, id: string): Promise<void> {
    this.table(table).delete(id);
  }

  async clear(table?: TableName): Promise<void> {
    if (table) this.table(table).clear();
    else this.tables.clear();
  }

  async transaction(fn: () => Promise<void>): Promise<void> {
    const backup = this.snapshot();
    try {
      await fn();
    } catch (e) {
      const restored = new MemoryStore(backup);
      this.tables = restored.tables;
      throw e;
    }
  }

  /** Serializes the whole store, used to simulate closing and reopening the app. */
  snapshot(): string {
    const out: Record<string, Record<string, string>> = {};
    for (const [t, rows] of this.tables) out[t] = Object.fromEntries(rows);
    return JSON.stringify(out);
  }
}
