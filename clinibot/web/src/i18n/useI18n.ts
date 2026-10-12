import { use } from "react";
import { I18nContext, type I18nValue } from "./context";

export function useI18n(): I18nValue {
  const value = use(I18nContext);
  if (!value) throw new Error("useI18n() must be used inside <I18nProvider>");
  return value;
}
