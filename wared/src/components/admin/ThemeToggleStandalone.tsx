'use client';

import { useEffect, useState } from 'react';
import { MoonIcon, SunIcon } from '@/components/ui/icons';

export function ThemeToggleStandalone() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const current = document.documentElement.dataset.theme;
    const isDark = current ? current === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    queueMicrotask(() => setDark(isDark));
  }, []);
  return (
    <button
      type="button"
      aria-label={dark ? 'الوضع الفاتح' : 'الوضع الداكن'}
      className="grid size-10 place-items-center rounded-full hover:bg-surface"
      onClick={() => {
        const next = dark ? 'light' : 'dark';
        document.documentElement.dataset.theme = next;
        try {
          localStorage.setItem('wared:theme', next);
        } catch {
          // ignore
        }
        setDark(!dark);
      }}
    >
      {dark ? <SunIcon size={18} /> : <MoonIcon size={18} />}
    </button>
  );
}
