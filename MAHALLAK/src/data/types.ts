export type TableName = 'items' | 'places' | 'placements' | 'images' | 'search_logs' | 'outbox' | 'kv';

export interface Row {
  id: string;
}

/**
 * Small document store. The app keeps every user's data on the device first
 * (fast, private, works offline); cloud sync is an optional layer on top.
 */
export interface DocumentStore {
  init(): Promise<void>;
  all<T extends Row>(table: TableName): Promise<T[]>;
  get<T extends Row>(table: TableName, id: string): Promise<T | null>;
  put<T extends Row>(table: TableName, row: T): Promise<void>;
  putMany<T extends Row>(table: TableName, rows: T[]): Promise<void>;
  remove(table: TableName, id: string): Promise<void>;
  clear(table?: TableName): Promise<void>;
  /** Runs writes atomically where the backend supports it. */
  transaction(fn: () => Promise<void>): Promise<void>;
}
