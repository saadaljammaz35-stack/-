import { Fragment, createElement, type ReactNode } from "react";
import { lookup, type MessageKey } from "./catalog";
import type { Lang, MessageParams } from "./types";

const PLACEHOLDER = /\{(\w+)\}/g;

/** Replaces `{name}` with params.name; unknown placeholders are left as-is. */
export function interpolate(message: string, params?: MessageParams): string {
  if (!params) return message;
  return message.replace(PLACEHOLDER, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match,
  );
}

export function translate(lang: Lang, key: MessageKey, params?: MessageParams): string {
  const message = lookup(lang, key);
  if (message === undefined) {
    if (import.meta.env.DEV) console.warn(`[i18n] missing message "${key}"`);
    return key;
  }
  return interpolate(message, params);
}

/**
 * Like translate(), but placeholders can be React nodes (links, <strong>…):
 *   tRich("auth.acceptTerms", { terms: <Link to="/terms">…</Link> })
 */
export function translateRich(
  lang: Lang,
  key: MessageKey,
  values: Readonly<Record<string, ReactNode>>,
): ReactNode {
  const message = lookup(lang, key) ?? key;
  const parts = message.split(PLACEHOLDER);
  // split() with a capture group alternates text, name, text, name, …
  return createElement(
    Fragment,
    null,
    ...parts.map((part, index) => {
      if (index % 2 === 0) return part;
      return Object.prototype.hasOwnProperty.call(values, part)
        ? createElement(Fragment, { key: `${part}-${index}` }, values[part])
        : `{${part}}`;
    }),
  );
}
