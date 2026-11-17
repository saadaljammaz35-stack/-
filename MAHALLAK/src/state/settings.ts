export interface UserSettings {
  language: 'ar' | 'en';
  theme: 'system' | 'light' | 'dark';
  onboardingDone: boolean;
  /** Continue without an account: everything stays on this device. */
  guest: boolean;
  /** Back up item records to the private cloud (opt-in). */
  cloudSync: boolean;
  /** Also back up photos of items and places (separate opt-in). */
  cloudPhotos: boolean;
  /** Send photos / unclear questions to cloud AI for recognition (opt-in). */
  aiConsent: boolean;
  /** Permission to use the user's data to improve models. Off, and never assumed. */
  aiTrainingConsent: boolean;
  keepSearchHistory: boolean;
  speechLang: 'ar-SA' | 'en-US';
  haptics: boolean;
  /** Accessibility / low-end devices: solid surfaces instead of live blur. */
  reduceTransparency: boolean;
}

export const DEFAULT_SETTINGS: UserSettings = {
  language: 'ar',
  theme: 'system',
  onboardingDone: false,
  guest: false,
  cloudSync: false,
  cloudPhotos: false,
  aiConsent: false,
  aiTrainingConsent: false,
  keepSearchHistory: true,
  speechLang: 'ar-SA',
  haptics: true,
  reduceTransparency: false,
};

export function sanitizeSettings(input: unknown): UserSettings {
  const s = { ...DEFAULT_SETTINGS };
  if (!input || typeof input !== 'object') return s;
  const o = input as Record<string, unknown>;
  if (o.language === 'ar' || o.language === 'en') s.language = o.language;
  if (o.theme === 'system' || o.theme === 'light' || o.theme === 'dark') s.theme = o.theme;
  if (o.speechLang === 'ar-SA' || o.speechLang === 'en-US') s.speechLang = o.speechLang;
  for (const k of ['onboardingDone', 'guest', 'cloudSync', 'cloudPhotos', 'aiConsent', 'aiTrainingConsent', 'keepSearchHistory', 'haptics', 'reduceTransparency'] as const) {
    if (typeof o[k] === 'boolean') s[k] = o[k] as boolean;
  }
  // photo backup requires record backup
  if (!s.cloudSync) s.cloudPhotos = false;
  return s;
}
