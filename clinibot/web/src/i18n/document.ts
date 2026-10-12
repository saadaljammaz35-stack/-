import { safeStorage, STORAGE_KEYS } from "@/lib/storage";
import { DEFAULT_LANG, dirOf, isLang, type Lang } from "./types";

export function readStoredLang(): Lang {
  const stored = safeStorage.get(STORAGE_KEYS.lang);
  return isLang(stored) ? stored : DEFAULT_LANG;
}

export function storeLang(lang: Lang): void {
  safeStorage.set(STORAGE_KEYS.lang, lang);
}

/** Sets <html lang dir> so the browser, CSS logical properties and screen readers follow. */
export function applyDocumentLang(lang: Lang): void {
  const root = document.documentElement;
  root.lang = lang;
  root.dir = dirOf(lang);
}
