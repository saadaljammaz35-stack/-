import { useCallback } from "react";
import { useI18n } from "@/i18n";
import type { FieldError } from "./model";

/** Turns a FieldError from the validators into text, formatting its numbers for the current language. */
export function useFieldErrorText(): (error: FieldError | undefined) => string | undefined {
  const { t, formatNumber } = useI18n();
  return useCallback(
    (error) => {
      if (!error) return undefined;
      const params: Record<string, string> = {};
      for (const [name, value] of Object.entries(error.params ?? {})) {
        params[name] = formatNumber(value);
      }
      return t(error.key, params);
    },
    [t, formatNumber],
  );
}
