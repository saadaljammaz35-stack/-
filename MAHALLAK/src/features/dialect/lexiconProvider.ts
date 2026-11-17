import { BUNDLED_LEXICON, type DialectLexicon } from './lexicon';
import { compileLexicon, type CompiledLexicon } from './parser';

/**
 * Loads the dialect lexicon: bundled baseline first, then a newer version from
 * the backend when available. Remote data is validated and only ever EXTENDS the
 * bundled terms, so a bad remote payload can never remove understanding.
 */

const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');

export function validateLexicon(input: unknown): DialectLexicon | null {
  if (!input || typeof input !== 'object') return null;
  const o = input as Record<string, unknown>;
  if (typeof o.version !== 'number' || !Number.isFinite(o.version)) return null;
  const m = o.markers as Record<string, unknown> | undefined;
  const markerKeys = ['find', 'want', 'placementVerbs', 'listContents', 'history', 'recent', 'smalltalk', 'whatQuestion', 'generic'];
  if (!m || !markerKeys.every((k) => m[k] === undefined || isStringArray(m[k]))) return null;
  const listOk = (v: unknown, extra?: (x: Record<string, unknown>) => boolean) =>
    v === undefined ||
    (Array.isArray(v) &&
      v.every((x) => x && typeof x === 'object' && typeof (x as { id?: unknown }).id === 'string' && isStringArray((x as { terms?: unknown }).terms) && (!extra || extra(x as Record<string, unknown>))));
  if (!listOk(o.items, (x) => typeof x.category === 'string')) return null;
  if (!listOk(o.places, (x) => typeof x.kind === 'string')) return null;
  if (!listOk(o.colors) || !listOk(o.time)) return null;
  if (o.locatives !== undefined && !isStringArray(o.locatives)) return null;
  if (o.fillers !== undefined && !isStringArray(o.fillers)) return null;
  const totalTerms = JSON.stringify(input).length;
  if (totalTerms > 2_000_000) return null; // refuse absurdly large payloads
  return input as DialectLexicon;
}

const union = (a: string[] = [], b: string[] = []) => [...new Set([...a, ...b])];

function mergeConcepts<T extends { id: string; terms: string[] }>(base: T[], extra: T[] | undefined): T[] {
  if (!extra) return base;
  const byId = new Map(base.map((c) => [c.id, { ...c, terms: [...c.terms] }]));
  for (const c of extra) {
    const existing = byId.get(c.id);
    byId.set(c.id, existing ? { ...existing, terms: union(existing.terms, c.terms) } : c);
  }
  return [...byId.values()];
}

export function mergeLexicons(base: DialectLexicon, remote: Partial<DialectLexicon> & { version: number }): DialectLexicon {
  const m = remote.markers ?? ({} as Partial<DialectLexicon['markers']>);
  return {
    version: Math.max(base.version, remote.version),
    markers: {
      find: union(base.markers.find, m.find),
      want: union(base.markers.want, m.want),
      placementVerbs: union(base.markers.placementVerbs, m.placementVerbs),
      listContents: union(base.markers.listContents, m.listContents),
      history: union(base.markers.history, m.history),
      recent: union(base.markers.recent, m.recent),
      smalltalk: union(base.markers.smalltalk, m.smalltalk),
      whatQuestion: union(base.markers.whatQuestion, m.whatQuestion),
      generic: union(base.markers.generic, m.generic),
    },
    locatives: union(base.locatives, remote.locatives),
    fillers: union(base.fillers, remote.fillers),
    items: mergeConcepts(base.items, remote.items),
    places: mergeConcepts(base.places, remote.places),
    colors: mergeConcepts(base.colors, remote.colors),
    time: mergeConcepts(base.time, remote.time),
    dialectMarkers: {
      najdi: union(base.dialectMarkers.najdi, remote.dialectMarkers?.najdi),
      hijazi: union(base.dialectMarkers.hijazi, remote.dialectMarkers?.hijazi),
      sharqi: union(base.dialectMarkers.sharqi, remote.dialectMarkers?.sharqi),
      janoubi: union(base.dialectMarkers.janoubi, remote.dialectMarkers?.janoubi),
      shamali: union(base.dialectMarkers.shamali, remote.dialectMarkers?.shamali),
    },
  };
}

export interface LexiconSource {
  /** Returns the newest published lexicon JSON, or null when offline/unavailable. */
  fetchLatest(): Promise<unknown | null>;
}

export interface LexiconCache {
  read(): Promise<unknown | null>;
  write(value: unknown): Promise<void>;
}

let current: { lexicon: DialectLexicon; compiled: CompiledLexicon } = {
  lexicon: BUNDLED_LEXICON,
  compiled: compileLexicon(BUNDLED_LEXICON),
};

export function getCompiledLexicon(): CompiledLexicon {
  return current.compiled;
}

export function getLexiconVersion(): number {
  return current.lexicon.version;
}

function apply(remote: unknown): boolean {
  const valid = validateLexicon(remote);
  if (!valid || valid.version <= current.lexicon.version) return false;
  const merged = mergeLexicons(BUNDLED_LEXICON, valid);
  current = { lexicon: merged, compiled: compileLexicon(merged) };
  return true;
}

/** Applies a cached copy instantly, then refreshes from the network in the background. */
export async function refreshLexicon(source: LexiconSource | null, cache: LexiconCache): Promise<number> {
  try {
    apply(await cache.read());
  } catch {
    // corrupted cache: ignore, bundled lexicon stays active
  }
  if (!source) return current.lexicon.version;
  try {
    const latest = await source.fetchLatest();
    if (latest && apply(latest)) await cache.write(latest);
  } catch {
    // offline: keep what we have
  }
  return current.lexicon.version;
}

/** Test hook. */
export function resetLexiconForTests(): void {
  current = { lexicon: BUNDLED_LEXICON, compiled: compileLexicon(BUNDLED_LEXICON) };
}
