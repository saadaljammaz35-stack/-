import type { ColorId } from '@/domain/categories';

import type { DialectId, DialectLexicon, TimeRefId } from './lexicon';
import { normalizeArabic, stemCandidates, tokenize } from './normalize';

export type QueryIntent =
  | 'find_item'
  | 'list_location'
  | 'item_history'
  | 'recent'
  | 'smalltalk'
  | 'unknown';

export interface ParsedQuery {
  raw: string;
  normalized: string;
  intent: QueryIntent;
  /** 0..1. Below CONFIDENCE_FLOOR the UI asks the user to rephrase. */
  confidence: number;
  itemConcepts: string[];
  tagConcepts: string[];
  placeConcepts: string[];
  colors: ColorId[];
  time?: TimeRefId;
  /** Words that probably describe the item but are not in the lexicon (brands, custom names). */
  itemTerms: string[];
  /** Free words that describe the place ("الثاني", "سارة"). */
  placeTerms: string[];
  dialectHints: DialectId[];
  lexiconVersion: number;
  source: 'rules' | 'ai';
}

export const CONFIDENCE_FLOOR = 0.45;

type MarkerKind =
  | 'find'
  | 'want'
  | 'verb'
  | 'list'
  | 'history'
  | 'recent'
  | 'smalltalk'
  | 'what'
  | 'generic'
  | 'locative'
  | 'filler';

type ConceptHit =
  | { type: 'item'; id: string; tag: boolean }
  | { type: 'place'; id: string }
  | { type: 'color'; id: ColorId }
  | { type: 'time'; id: TimeRefId };

export interface CompiledLexicon {
  version: number;
  markers: Map<string, MarkerKind>;
  concepts: Map<string, ConceptHit[]>;
  maxPhrase: number;
  dialectMarkers: Array<[DialectId, Set<string>]>;
  categoryOf: Map<string, string>;
  meta: Map<string, { category: string; parent?: string; generic: boolean; tag: boolean }>;
}

/** Removes a leading definite article from each word so "الهوية الوطنية" == "هوية وطنية". */
function canonical(phrase: string): string {
  return phrase
    .split(' ')
    .map((w) => (w.startsWith('ال') && w.length > 3 ? w.slice(2) : w))
    .join(' ');
}

const MARKER_PRIORITY: MarkerKind[] = [
  'smalltalk',
  'history',
  'list',
  'recent',
  'find',
  'want',
  'verb',
  'generic',
  'what',
  'locative',
  'filler',
];

export function compileLexicon(lex: DialectLexicon): CompiledLexicon {
  const markers = new Map<string, MarkerKind>();
  const add = (kind: MarkerKind, terms: string[]) => {
    for (const t of terms) {
      const key = normalizeArabic(t);
      if (!key) continue;
      const existing = markers.get(key);
      if (!existing || MARKER_PRIORITY.indexOf(kind) < MARKER_PRIORITY.indexOf(existing)) {
        markers.set(key, kind);
      }
    }
  };
  add('smalltalk', lex.markers.smalltalk);
  add('history', lex.markers.history);
  add('list', lex.markers.listContents);
  add('recent', lex.markers.recent);
  add('find', lex.markers.find);
  add('want', lex.markers.want);
  add('verb', lex.markers.placementVerbs);
  add('generic', lex.markers.generic);
  add('what', lex.markers.whatQuestion);
  add('locative', lex.locatives);
  add('filler', lex.fillers);

  const concepts = new Map<string, ConceptHit[]>();
  const categoryOf = new Map<string, string>();
  const meta = new Map<string, { category: string; parent?: string; generic: boolean; tag: boolean }>();
  const addConcept = (term: string, hit: ConceptHit) => {
    const key = canonical(normalizeArabic(term));
    if (!key) return;
    const list = concepts.get(key) ?? [];
    if (!list.some((h) => h.type === hit.type && h.id === hit.id)) list.push(hit);
    concepts.set(key, list);
  };
  for (const item of lex.items) {
    categoryOf.set(item.id, item.category);
    meta.set(item.id, { category: item.category, parent: item.parent, generic: Boolean(item.generic), tag: Boolean(item.tag) });
    for (const t of item.terms) addConcept(t, { type: 'item', id: item.id, tag: Boolean(item.tag) });
  }
  for (const place of lex.places) for (const t of place.terms) addConcept(t, { type: 'place', id: place.id });
  for (const color of lex.colors) for (const t of color.terms) addConcept(t, { type: 'color', id: color.id });
  for (const time of lex.time) for (const t of time.terms) addConcept(t, { type: 'time', id: time.id });

  let maxPhrase = 1;
  for (const key of [...markers.keys(), ...concepts.keys()]) {
    maxPhrase = Math.max(maxPhrase, key.split(' ').length);
  }

  const dialectMarkers = (Object.keys(lex.dialectMarkers) as DialectId[]).map(
    (d) => [d, new Set(lex.dialectMarkers[d].map(normalizeArabic))] as [DialectId, Set<string>],
  );

  return { version: lex.version, markers, concepts, maxPhrase: Math.min(maxPhrase, 5), dialectMarkers, categoryOf, meta };
}

// Markers that are sometimes glued to the next word by speech-to-text ("وينحطيت").
const GLUE_PREFIXES = ['وين', 'فين', 'وش', 'ايش'];

function splitGlued(tokens: string[], lex: CompiledLexicon): string[] {
  const out: string[] = [];
  for (const t of tokens) {
    const prefix = GLUE_PREFIXES.find((p) => t.startsWith(p) && t.length >= p.length + 3);
    if (prefix && !lex.markers.has(t) && !lex.concepts.has(canonical(t))) {
      const rest = t.slice(prefix.length);
      if (lex.markers.has(rest) || stemCandidates(rest).some((c) => lex.concepts.has(canonical(c)))) {
        out.push(prefix, rest);
        continue;
      }
    }
    out.push(t);
  }
  return out;
}

/** Expands each token into candidate stems, then tries every combination for a phrase. */
function matchConceptPhrase(
  tokens: string[],
  start: number,
  n: number,
  lex: CompiledLexicon,
): { hits: ConceptHit[]; viaPrefix: boolean } | null {
  const pools = tokens.slice(start, start + n).map((t, idx) =>
    // only the first token of a phrase may carry a proclitic (بالدرج)
    idx === 0 ? stemCandidates(t) : [t, ...stemCandidates(t).slice(1)],
  );
  let combos: Array<{ words: string[]; prefixed: boolean }> = [{ words: [], prefixed: false }];
  for (let i = 0; i < pools.length; i++) {
    const next: Array<{ words: string[]; prefixed: boolean }> = [];
    for (const c of combos) {
      for (const cand of pools[i]) {
        const prefixed = c.prefixed || (i === 0 && cand !== tokens[start] && /^(ب|ف|ع|و|ل)/.test(tokens[start]) && !tokens[start].startsWith('ال'));
        next.push({ words: [...c.words, cand], prefixed });
        if (next.length > 400) break;
      }
    }
    combos = next;
  }
  for (const c of combos) {
    const key = canonical(c.words.join(' '));
    const hits = lex.concepts.get(key);
    if (hits) {
      const locativePrefix = /^(ب|ف|ع)/.test(tokens[start]) && c.words[0] !== tokens[start];
      return { hits, viaPrefix: locativePrefix || c.prefixed };
    }
  }
  return null;
}

function hasFindSignal(seen: Set<MarkerKind>): boolean {
  return seen.has('find') || seen.has('want');
}

// "المفتاح حق السيارة" means "مفتاح السيارة": dropping the particle lets phrases match.
const POSSESSIVES = new Set(['حق', 'حقت', 'حقة', 'مال', 'مالت', 'تبع', 'تبعت', 'of']);

function dropPossessives(tokens: string[]): string[] {
  return tokens.filter((t, i) => !(POSSESSIVES.has(t) && i > 0 && i < tokens.length - 1));
}

export function parseQuery(raw: string, lex: CompiledLexicon): ParsedQuery {
  const normalized = normalizeArabic(raw);
  const tokens = dropPossessives(splitGlued(tokenize(normalized), lex));

  const seen = new Set<MarkerKind>();
  const itemConcepts: string[] = [];
  const tagConcepts: string[] = [];
  const placeConcepts: string[] = [];
  const colors: ColorId[] = [];
  let time: TimeRefId | undefined;
  const itemTerms: string[] = [];
  const placeTerms: string[] = [];
  let locativeMode = false;
  let recognized = 0;

  let i = 0;
  while (i < tokens.length) {
    let consumed = 0;
    for (let n = Math.min(lex.maxPhrase, tokens.length - i); n >= 1 && consumed === 0; n--) {
      const phrase = tokens.slice(i, i + n).join(' ');
      const marker = lex.markers.get(phrase);
      const concept = matchConceptPhrase(tokens, i, n, lex);
      // Prefer the concept when the same span is also a weak marker (filler/generic).
      const weakMarker = marker === 'filler' || marker === 'generic' || marker === 'what';
      if (marker && !(concept && weakMarker && n > 1)) {
        seen.add(marker);
        if (marker === 'locative') locativeMode = true;
        else if (marker === 'list') locativeMode = true;
        else if (marker !== 'filler' && marker !== 'generic' && marker !== 'what') locativeMode = false;
        if (marker !== 'filler') recognized++;
        consumed = n;
        break;
      }
      if (concept) {
        const asPlace = concept.hits.find((h) => h.type === 'place');
        const asItem = concept.hits.find((h) => h.type === 'item');
        const preferPlace = asPlace && (!asItem || locativeMode || concept.viaPrefix || seen.has('list'));
        for (const hit of concept.hits) {
          if (hit.type === 'color' && !colors.includes(hit.id)) colors.push(hit.id);
          if (hit.type === 'time') time = hit.id;
        }
        if (preferPlace && asPlace) {
          if (!placeConcepts.includes(asPlace.id)) placeConcepts.push(asPlace.id);
          locativeMode = true;
        } else if (asItem && asItem.type === 'item' && locativeMode && seen.has('list') && !hasFindSignal(seen)) {
          // "ايش في الرف حق الكتب": inside a listing question, item words describe the place.
          for (const w of tokens.slice(i, i + n)) {
            const term = canonical(w);
            if (!placeTerms.includes(term)) placeTerms.push(term);
          }
        } else if (asItem) {
          for (const hit of concept.hits) {
            if (hit.type !== 'item') continue;
            const target = hit.tag ? tagConcepts : itemConcepts;
            if (!target.includes(hit.id)) target.push(hit.id);
          }
          locativeMode = false;
        }
        recognized++;
        consumed = n;
        break;
      }
    }
    if (consumed === 0) {
      const token = tokens[i];
      // A bare letter or a one-letter clitic adds nothing.
      if (token.length > 1 && !/^\d+$/.test(token)) {
        const stem = canonical(stemCandidates(token).find((c) => c !== token && c.length >= 2) ?? token);
        const term = canonical(token);
        if (locativeMode) {
          if (!placeTerms.includes(term)) placeTerms.push(term);
          if (stem !== term && !placeTerms.includes(stem)) placeTerms.push(stem);
        } else if (!itemTerms.includes(term)) {
          itemTerms.push(term);
        }
      }
      consumed = 1;
    }
    i += consumed;
  }

  const dialectHints = lex.dialectMarkers
    .filter(([, markers]) => tokens.some((t) => markers.has(t)))
    .map(([d]) => d);

  const hasFind = seen.has('find') || seen.has('want') || seen.has('verb');
  const hasItem = itemConcepts.length > 0 || tagConcepts.length > 0;
  const hasItemWords = hasItem || itemTerms.length > 0;
  const hasPlace = placeConcepts.length > 0 || (seen.has('list') && placeTerms.length > 0);

  let intent: QueryIntent = 'unknown';
  let confidence = 0;

  if (seen.has('smalltalk') && !hasItem && !hasPlace) {
    intent = 'smalltalk';
    confidence = 0.9;
  } else if (seen.has('history') && hasItemWords) {
    intent = 'item_history';
    confidence = hasItem ? 0.9 : 0.6;
  } else if (seen.has('recent') && !hasItem) {
    intent = 'recent';
    confidence = 0.85;
  } else if (hasPlace && !hasItem && (itemTerms.length === 0 || seen.has('list'))) {
    intent = 'list_location';
    const explicit = seen.has('list') || seen.has('what') || seen.has('generic');
    confidence = explicit ? 0.9 : 0.6;
  } else if (hasItemWords) {
    intent = 'find_item';
    confidence = 0.35 + (hasFind ? 0.3 : 0) + (hasItem ? 0.3 : 0) + (colors.length > 0 ? 0.05 : 0);
    // Only unknown words and no question at all ("سوني") stays below the floor.
    if (!hasItem && !hasFind && itemTerms.length > 0) confidence = 0.4;
  } else if (seen.has('generic') && time) {
    // "وش الاغراض اللي حطيتها امس" -> recent within a time window
    intent = 'recent';
    confidence = 0.75;
  }

  if (recognized === 0 && intent !== 'smalltalk') confidence = Math.min(confidence, 0.4);

  return {
    raw,
    normalized,
    intent,
    confidence: Math.min(1, Number(confidence.toFixed(2))),
    itemConcepts,
    tagConcepts,
    placeConcepts,
    colors,
    time,
    itemTerms,
    placeTerms,
    dialectHints,
    lexiconVersion: lex.version,
    source: 'rules',
  };
}

/** Concepts found in arbitrary text (item names, location labels). Used to index user data. */
export function extractConcepts(
  text: string,
  lex: CompiledLexicon,
): { items: string[]; places: string[]; colors: ColorId[]; tokens: string[] } {
  const tokens = tokenize(normalizeArabic(text));
  const items: string[] = [];
  const places: string[] = [];
  const colors: ColorId[] = [];
  const free: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    let consumed = 0;
    for (let n = Math.min(lex.maxPhrase, tokens.length - i); n >= 1 && consumed === 0; n--) {
      const m = matchConceptPhrase(tokens, i, n, lex);
      if (m) {
        for (const hit of m.hits) {
          if (hit.type === 'item' && !items.includes(hit.id)) items.push(hit.id);
          if (hit.type === 'place' && !places.includes(hit.id)) places.push(hit.id);
          if (hit.type === 'color' && !colors.includes(hit.id)) colors.push(hit.id);
        }
        consumed = n;
      }
    }
    const t = tokens[i];
    free.push(canonical(t));
    for (const c of stemCandidates(t)) if (c !== t && c.length >= 2) free.push(canonical(c));
    i += Math.max(consumed, 1);
    if (consumed > 1) {
      for (let k = 1; k < consumed; k++) free.push(canonical(tokens[i - consumed + k]));
    }
  }
  return { items, places, colors, tokens: [...new Set(free)] };
}
