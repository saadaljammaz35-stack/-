export const LANGS = ["ar", "en"] as const;
export type Lang = (typeof LANGS)[number];
export type Dir = "rtl" | "ltr";

export const DEFAULT_LANG: Lang = "ar";

export function isLang(value: unknown): value is Lang {
  return value === "ar" || value === "en";
}

export function dirOf(lang: Lang): Dir {
  return lang === "ar" ? "rtl" : "ltr";
}

/** A flat table of message strings. Placeholders look like `{name}`. */
export type Messages = Readonly<Record<string, string>>;

/**
 * Shape of every file in `src/i18n/messages/`:
 *
 *   export default { ar: { … }, en: { … } } satisfies Namespace;
 *
 * `en` must have exactly the keys of `ar`; `KeyParity` in `catalog.ts`
 * turns any difference into a type error, and `i18n.test.ts` checks it again.
 */
export type Namespace = { readonly ar: Messages; readonly en: Messages };

/** Keys present in `ar` but missing from `en` (and vice versa). */
export type MissingInEn<N extends Namespace> = Exclude<keyof N["ar"], keyof N["en"]>;
export type ExtraInEn<N extends Namespace> = Exclude<keyof N["en"], keyof N["ar"]>;

/**
 * Resolves to the catalog itself when every namespace's `en` keys equal its
 * `ar` keys; otherwise the offending namespace becomes an error object that
 * names the keys, e.g. `{ missingInEn: "title"; extraInEn: never }`.
 */
export type KeyParity<T extends Record<string, Namespace>> = {
  [K in keyof T]: [MissingInEn<T[K]>, ExtraInEn<T[K]>] extends [never, never]
    ? T[K]
    : {
        error: "en must have exactly the same keys as ar";
        namespace: K;
        missingInEn: MissingInEn<T[K]>;
        extraInEn: ExtraInEn<T[K]>;
      };
};

export type MessageParams = Readonly<Record<string, string | number>>;
