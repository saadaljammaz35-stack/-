import { createContext, type ReactNode } from "react";
import type { MessageKey } from "./catalog";
import type { DateInput } from "./format";
import type { Dir, Lang, MessageParams } from "./types";

export type TFunction = (key: MessageKey, params?: MessageParams) => string;

export interface I18nValue {
  lang: Lang;
  dir: Dir;
  /** t("auth.loginTitle"), t("errors.rate_limited", { seconds: 30 }) */
  t: TFunction;
  /** Placeholders replaced by React nodes: tRich("auth.acceptTerms", { terms: <Link…/> }) */
  tRich: (key: MessageKey, values: Readonly<Record<string, ReactNode>>) => ReactNode;
  setLang: (lang: Lang) => void;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatDate: (value: DateInput, options?: Intl.DateTimeFormatOptions) => string;
  formatSar: (amount: number) => string;
}

export const I18nContext = createContext<I18nValue | null>(null);
