import type { DocumentStore, Row, TableName } from './types';

/**
 * Web build (preview / PWA): documents persisted in localStorage. The native
 * apps use SQLite; this keeps the web preview working without SharedArrayBuffer.
 */
export class SQLiteStore implements DocumentStore {
  private cache = new Map<TableName, Map<string, Row>>();

  constructor(private name = 'mahallak.db') {}

  private key(t: TableName) {
    return `${this.name}:${t}`;
  }

  async init(): Promise<void> {}

  private load(t: TableName): Map<string, Row> {
    let m = this.cache.get(t);
    if (m) return m;
    m = new Map();
    try {
      const raw = globalThis.localStorage?.getItem(this.key(t));
      if (raw) for (const r of JSON.parse(raw) as Row[]) m.set(r.id, r);
    } catch {
      // storage unavailable (private mode): keep in memory only
    }
    this.cache.set(t, m);
    return m;
  }

  private save(t: TableName) {
    try {
      globalThis.localStorage?.setItem(this.key(t), JSON.stringify([...this.load(t).values()]));
    } catch {
      // quota exceeded or unavailable
    }
  }

  async all<T extends Row>(table: TableName): Promise<T[]> {
    return [...this.load(table).values()] as T[];
  }
  async get<T extends Row>(table: TableName, id: string): Promise<T | null> {
    return (this.load(table).get(id) as T) ?? null;
  }
  async put<T extends Row>(table: TableName, row: T): Promise<void> {
    this.load(table).set(row.id, row);
    this.save(table);
  }
  async putMany<T extends Row>(table: TableName, rows: T[]): Promise<void> {
    const m = this.load(table);
    for (const r of rows) m.set(r.id, r);
    this.save(table);
  }
  async remove(table: TableName, id: string): Promise<void> {
    this.load(table).delete(id);
    this.save(table);
  }
  async clear(table?: TableName): Promise<void> {
    const tables: TableName[] = table ? [table] : ['items', 'places', 'placements', 'images', 'search_logs', 'outbox', 'kv'];
    for (const t of tables) {
      this.cache.set(t, new Map());
      this.save(t);
    }
  }
  async transaction(fn: () => Promise<void>): Promise<void> {
    await fn();
  }
}
