'use client';
import { useSyncExternalStore } from 'react';
import type { Selection } from '@/lib/catalog-types';

export interface CartLine {
  key: string;
  productId: string;
  slug: string;
  quantity: number;
  selection: Selection;
  nameAr: string;
  nameEn: string;
  imageUrl: string | null;
  unitPrice: number; // preview; the server re-prices at checkout
  summaryAr: string[];
  summaryEn: string[];
  addedAt: number;
}

const KEY = 'samat_cart_v1';
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 3; // a cart older than 3 days is dropped
let lines: CartLine[] = [];
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]') as CartLine[];
    lines = Array.isArray(raw) ? raw.filter((l) => l && l.productId && Date.now() - (l.addedAt ?? 0) < MAX_AGE_MS) : [];
  } catch {
    lines = [];
  }
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(lines));
  } catch {
    /* storage full or disabled: cart still works for this session */
  }
  listeners.forEach((l) => l());
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) {
      loaded = false;
      load();
      listeners.forEach((l) => l());
    }
  });
}

export const cart = {
  get(): CartLine[] {
    load();
    return lines;
  },
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  add(line: Omit<CartLine, 'key' | 'addedAt'>) {
    load();
    lines = [...lines, { ...line, key: crypto.randomUUID(), addedAt: Date.now() }];
    persist();
  },
  replace(key: string, line: Omit<CartLine, 'key' | 'addedAt'>) {
    load();
    lines = lines.map((l) => (l.key === key ? { ...line, key, addedAt: Date.now() } : l));
    persist();
  },
  setQuantity(key: string, quantity: number) {
    load();
    lines = quantity <= 0 ? lines.filter((l) => l.key !== key) : lines.map((l) => (l.key === key ? { ...l, quantity: Math.min(quantity, 20) } : l));
    persist();
  },
  setUnitPrices(prices: Record<string, number>) {
    load();
    lines = lines.map((l) => (prices[l.key] !== undefined ? { ...l, unitPrice: prices[l.key] } : l));
    persist();
  },
  remove(key: string) {
    load();
    lines = lines.filter((l) => l.key !== key);
    persist();
  },
  clear() {
    lines = [];
    persist();
  },
};

const EMPTY: CartLine[] = [];
export function useCart(): CartLine[] {
  return useSyncExternalStore(cart.subscribe, cart.get, () => EMPTY);
}

export function useCartCount(): number {
  return useCart().reduce((n, l) => n + l.quantity, 0);
}
