'use client';

import { useEffect } from 'react';

/** Clears the intro offset once the opening has played, so later route
 *  changes animate without waiting for it. */
export function IntroDone() {
  useEffect(() => {
    const root = document.documentElement;
    if (root.dataset.intro !== 'play') return;
    const id = window.setTimeout(() => {
      root.dataset.intro = 'done';
    }, 2100);
    return () => window.clearTimeout(id);
  }, []);
  return null;
}
