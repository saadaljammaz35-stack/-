import { useCallback, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import { STORAGE_KEYS } from "@/lib/storage";
import { I18nContext, type I18nValue } from "./context";
import { applyDocumentLang, readStoredLang, storeLang } from "./document";
import { formatDate, formatNumber, formatSar } from "./format";
import { translate, translateRich } from "./translate";
import { dirOf, isLang, type Lang } from "./types";

interface I18nProviderProps {
  children: ReactNode;
  /** Mainly for tests; defaults to the stored preference, then Arabic. */
  initialLang?: Lang;
}

export function I18nProvider({ children, initialLang }: I18nProviderProps) {
  const [lang, setLangState] = useState<Lang>(() => initialLang ?? readStoredLang());

  useLayoutEffect(() => {
    applyDocumentLang(lang);
  }, [lang]);

  // Keep several open tabs in the same language.
  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key === STORAGE_KEYS.lang && isLang(event.newValue)) setLangState(event.newValue);
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setLang = useCallback((next: Lang) => {
    storeLang(next);
    setLangState(next);
  }, []);

  const value = useMemo<I18nValue>(
    () => ({
      lang,
      dir: dirOf(lang),
      t: (key, params) => translate(lang, key, params),
      tRich: (key, values) => translateRich(lang, key, values),
      setLang,
      formatNumber: (value, options) => formatNumber(lang, value, options),
      formatDate: (value, options) => formatDate(lang, value, options),
      formatSar: (amount) => formatSar(lang, amount),
    }),
    [lang, setLang],
  );

  return <I18nContext value={value}>{children}</I18nContext>;
}
