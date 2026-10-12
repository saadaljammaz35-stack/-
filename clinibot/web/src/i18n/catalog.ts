import * as namespaces from "./messages";
import type { KeyParity, Lang, Messages, Namespace } from "./types";

type Catalog = typeof namespaces;

/** Every namespace, type-checked for identical ar/en key sets. */
export const catalog = namespaces satisfies KeyParity<Catalog>;

export type NamespaceName = keyof Catalog;

/** Every valid message key, e.g. "auth.loginTitle". */
export type MessageKey = {
  [N in NamespaceName]: `${N}.${Extract<keyof Catalog[N]["ar"], string>}`;
}[NamespaceName];

const table = catalog as unknown as Readonly<Record<string, Namespace>>;

export function namespaceNames(): string[] {
  return Object.keys(table);
}

export function getNamespace(name: string): Namespace | undefined {
  return table[name];
}

/** Looks up a raw message; falls back to Arabic, then undefined. */
export function lookup(lang: Lang, key: string): string | undefined {
  const dot = key.indexOf(".");
  if (dot <= 0) return undefined;
  const ns = table[key.slice(0, dot)];
  if (!ns) return undefined;
  const name = key.slice(dot + 1);
  const messages: Messages = ns[lang];
  return messages[name] ?? ns.ar[name];
}

export function hasMessage(key: string): key is MessageKey {
  return lookup("ar", key) !== undefined;
}
