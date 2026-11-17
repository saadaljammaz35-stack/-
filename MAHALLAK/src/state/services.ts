import { SQLiteStore } from '@/data/sqliteStore';
import type { DocumentStore } from '@/data/types';
import { ItemService } from '@/services/itemService';

let store: DocumentStore | null = null;
let items: ItemService | null = null;
let listener: () => void = () => {};

export function setChangeListener(fn: () => void) {
  listener = fn;
}

export function getStore(): DocumentStore {
  if (!store) store = new SQLiteStore();
  return store;
}

export function getItemService(): ItemService {
  if (!items) items = new ItemService(getStore(), () => listener());
  return items;
}

/** Tests can inject an in-memory store. */
export function setStoreForTests(s: DocumentStore) {
  store = s;
  items = null;
}
