'use client';

import { useSyncExternalStore } from 'react';

const stores = new Map<string, { subscribe(cb: () => void): () => void; get(): boolean }>();

function mediaStore(query: string) {
  const cached = stores.get(query);
  if (cached) return cached;
  const store = {
    subscribe(cb: () => void) {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', cb);
      return () => mql.removeEventListener('change', cb);
    },
    get: () => window.matchMedia(query).matches,
  };
  stores.set(query, store);
  return store;
}

/** SSR-safe media query (false on the server and on first hydration pass). */
export function useMediaQuery(query: string): boolean {
  const store = mediaStore(query);
  return useSyncExternalStore(store.subscribe, store.get, () => false);
}

export const useReducedMotion = () => useMediaQuery('(prefers-reduced-motion: reduce)');

/** Desktop-class pointer with hover, and motion allowed. */
export function useFinePointer(): boolean {
  const fine = useMediaQuery('(hover: hover) and (pointer: fine)');
  const reduced = useReducedMotion();
  return fine && !reduced;
}
