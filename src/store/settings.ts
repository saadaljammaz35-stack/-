import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { DEFAULT_NOTIFICATION_SETTINGS, normalizeAdhanSound, type NotificationSettings } from '@/lib/notification-plan';
import { DEFAULT_PRAYER_SETTINGS, type PlaceLocation, type PrayerSettings } from '@/lib/prayer-times';
import type { DigitStyle } from '@/lib/time';

import { jsonStorage, storageKey } from './storage';

export type ThemeMode = 'system' | 'light' | 'dark' | 'warm';
export type AccentId = 'sage' | 'teal' | 'olive' | 'navy' | 'plum';
export type Language = 'ar' | 'en';
export type ReadingFont = 'amiri' | 'plex';

export type HomeShortcut =
  | 'tasbih'
  | 'qibla'
  | 'after-prayer'
  | 'live'
  | 'khatma'
  | 'hadith'
  | 'duas'
  | 'names'
  | 'radio'
  | 'calendar'
  | 'fatwa'
  | 'morning'
  | 'evening'
  | 'sleep';

export type SettingsState = {
  themeMode: ThemeMode;
  accent: AccentId;
  language: Language;
  uiScale: number;
  readingFont: ReadingFont;
  readingScale: number;
  quranScale: number;
  digits: DigitStyle;
  use24h: boolean;
  haptics: boolean;
  keepAwakeInMushaf: boolean;
  showTranslation: boolean;
  translationId: number;
  location: PlaceLocation | null;
  prayer: PrayerSettings;
  notifications: NotificationSettings;
  shortcuts: HomeShortcut[];
  reciterId: number;
  playbackRate: number;
  onboarded: boolean;
  set: (patch: Partial<Omit<SettingsState, 'set' | 'setPrayer' | 'setNotifications'>>) => void;
  setPrayer: (patch: Partial<PrayerSettings>) => void;
  setNotifications: (patch: Partial<NotificationSettings>) => void;
};

export const DEFAULT_SHORTCUTS: HomeShortcut[] = ['tasbih', 'qibla', 'after-prayer', 'live', 'khatma', 'names'];

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      themeMode: 'system',
      accent: 'sage',
      language: 'ar',
      uiScale: 1,
      readingFont: 'amiri',
      readingScale: 1,
      quranScale: 1,
      digits: 'latin',
      use24h: false,
      haptics: true,
      keepAwakeInMushaf: true,
      showTranslation: false,
      translationId: 20,
      location: null,
      prayer: DEFAULT_PRAYER_SETTINGS,
      notifications: DEFAULT_NOTIFICATION_SETTINGS,
      shortcuts: DEFAULT_SHORTCUTS,
      reciterId: 97,
      playbackRate: 1,
      onboarded: false,
      set: (patch) => set(patch),
      setPrayer: (patch) => set((s) => ({ prayer: { ...s.prayer, ...patch } })),
      setNotifications: (patch) => set((s) => ({ notifications: { ...s.notifications, ...patch } })),
    }),
    {
      name: storageKey('settings'),
      storage: jsonStorage,
      version: 1,
      partialize: ({ set: _s, setPrayer: _p, setNotifications: _n, ...rest }) => rest,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<SettingsState>;
        const notifications = { ...current.notifications, ...p.notifications };
        // Older versions stored other adhan sound ids.
        notifications.prayers = Object.fromEntries(
          Object.entries({ ...current.notifications.prayers, ...p.notifications?.prayers }).map(([id, v]) => [id, { ...v, sound: normalizeAdhanSound(v.sound) }]),
        ) as NotificationSettings['prayers'];
        return {
          ...current,
          ...p,
          prayer: { ...current.prayer, ...p.prayer },
          notifications,
        };
      },
    },
  ),
);
