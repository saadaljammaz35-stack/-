import { useEffect, useState } from 'react';

import { getAdhkarCategories, resolveSources, type DhikrItem } from '@/data/content';

const listCache = new Map<string, DhikrItem[]>();

/** The counted items of an adhkar list (cached; the lists do not change while the app runs). */
export function useAdhkarList(id: string): DhikrItem[] | null {
  const [items, setItems] = useState<DhikrItem[] | null>(listCache.get(id) ?? null);
  useEffect(() => {
    if (listCache.has(id)) return;
    let alive = true;
    (async () => {
      const cat = (await getAdhkarCategories()).find((c) => c.id === id);
      const list = (cat ? await resolveSources(cat.sources) : []).filter((i) => i.kind !== 'surah');
      listCache.set(id, list);
      if (alive) setItems(list);
    })();
    return () => {
      alive = false;
    };
  }, [id]);
  return items;
}
