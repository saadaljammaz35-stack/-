import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { DEFAULT_IQAMA } from '@/lib/between';
import { DEFAULT_NOTIFICATION_SETTINGS, normalizeAdhanSound, type NotificationSettings } from '@/lib/notification-plan';
import { DEFAULT_PRAYER_SETTINGS, type PlaceLocation, type PrayerSettings } from '@/lib/prayer-times';
import type { FardId } from '@/lib/prayer-log';
import type { DigitStyle } from '@/lib/time';

import { jsonStorage, storageKey } from './storage';

export type ThemeMode = 'system' | 'light' | 'dark' | 'warm';
export type AccentId = 'sage' | 'teal' | 'olive' | 'navy' | 'plum';
export type Language = 'ar' | 'en';
export type ReadingFont = 'amiri' | 'plex';

export type HomeShortcut =
  | 'my-prayers'
  | 'hifz'
  | 'harvest'
  | 'group'
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
  | 'sleep'
  | 'virtues'
  | 'mosques'
  | 'my-duas'
  | 'between'
  | 'listening'
  | 'khatma-map'
  | 'walk'
  | 'qada'
  | 'travel'
  | 'flight'
  | 'situations'
  | 'sleep-calm'
  | 'tasbih-dark'
  | 'sky'
  | 'mosque-screen'
  | 'halaqa'
  | 'circles'
  | 'kids'
  | 'friday'
  | 'sleep-wird';

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
  /** Light up each word in the mushaf as the reciter reaches it. */
  followWords: boolean;
  showTranslation: boolean;
  translationId: number;
  location: PlaceLocation | null;
  prayer: PrayerSettings;
  notifications: NotificationSettings;
  shortcuts: HomeShortcut[];
  reciterId: number;
  playbackRate: number;
  onboarded: boolean;
  /** Adhkar reading layout: one dhikr per page, or all in a list. */
  adhkarView: 'pages' | 'list';
  /** The next prayer's countdown on the Lock Screen / Dynamic Island (iOS) or as an ongoing notification (Android). */
  liveCountdown: boolean;
  /** Tint memorised verses in the mushaf by how firmly they are held. */
  hifzColors: boolean;
  /** Minutes from each adhan to its iqama at the user's mosque. */
  iqama: Record<FardId, number>;
  /** Android: Do Not Disturb around the chosen prayers in the mosque. */
  mosqueSilent: { enabled: boolean; prayers: FardId[]; minutes: number };
  /** The user's home town, to notice travel (set with the first location). */
  home: PlaceLocation | null;
  /** Rain and wind adhkar from the weather where the user is (MET Norway, opt-in). */
  weatherAdhkar: boolean;
  /** Shown on the mosque screen. */
  mosqueName: string;
  set: (patch: Partial<Omit<SettingsState, 'set' | 'setPrayer' | 'setNotifications'>>) => void;
  setPrayer: (patch: Partial<PrayerSettings>) => void;
  setNotifications: (patch: Partial<NotificationSettings>) => void;
};

export const DEFAULT_SHORTCUTS: HomeShortcut[] = ['tasbih', 'qibla', 'hifz', 'after-prayer', 'live', 'khatma', 'names'];

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
      followWords: true,
      showTranslation: false,
      translationId: 20,
      location: null,
      prayer: DEFAULT_PRAYER_SETTINGS,
      notifications: DEFAULT_NOTIFICATION_SETTINGS,
      shortcuts: DEFAULT_SHORTCUTS,
      reciterId: 97,
      playbackRate: 1,
      onboarded: false,
      adhkarView: 'pages',
      liveCountdown: false,
      hifzColors: false,
      iqama: DEFAULT_IQAMA,
      mosqueSilent: { enabled: false, prayers: ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'], minutes: 20 },
      home: null,
      weatherAdhkar: false,
      mosqueName: '',
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
