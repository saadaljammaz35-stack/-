'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/components/I18nProvider';
import { MoonIcon, SunIcon } from '@/components/ui/icons';

type Theme = 'system' | 'light' | 'dark';
const KEY = 'wared:theme';

export const themeScript = `(function(){try{var t=localStorage.getItem('${KEY}');if(t==='light'||t==='dark'){document.documentElement.dataset.theme=t}}catch(e){}})();`;

function apply(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = theme;
  try {
    if (theme === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, theme);
  } catch {
    // Theme still applies for this visit.
  }
}

export function ThemeToggle() {
  const { dict } = useI18n();
  const [theme, setTheme] = useState<Theme>('system');

  useEffect(() => {
    const current = document.documentElement.dataset.theme;
    const initial: Theme = current === 'light' || current === 'dark' ? current : 'system';
    queueMicrotask(() => setTheme(initial));
  }, []);

  const next: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' };
  const label = { system: dict.nav.themeSystem, light: dict.nav.themeLight, dark: dict.nav.themeDark }[theme];

  return (
    <button
      type="button"
      onClick={() => {
        const value = next[theme];
        apply(value);
        setTheme(value);
      }}
      className="grid size-11 place-items-center rounded-full text-fg transition-colors hover:bg-surface"
      aria-label={`${dict.nav.themeLabel}: ${label}`}
      title={`${dict.nav.themeLabel}: ${label}`}
    >
      {theme === 'dark' ? <MoonIcon size={20} /> : theme === 'light' ? <SunIcon size={20} /> : (
        <span className="relative block size-5" aria-hidden="true">
          <span className="absolute inset-0 rounded-full border-[1.5px] border-current" />
          <span className="absolute inset-y-0 end-0 w-1/2 rounded-e-full bg-current" />
        </span>
      )}
    </button>
  );
}
