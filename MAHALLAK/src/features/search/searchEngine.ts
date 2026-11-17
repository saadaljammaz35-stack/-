import type { RoomId } from '@/domain/categories';
import type { Item, Place } from '@/domain/models';
import { extractConcepts, type CompiledLexicon, type ParsedQuery, CONFIDENCE_FLOOR } from '@/features/dialect/parser';
import type { TimeRefId } from '@/features/dialect/lexicon';
import { fuzzyEquals, normalizeArabic } from '@/features/dialect/normalize';

export interface SearchDoc {
  item: Item;
  place: Place | null;
}

export interface SearchHit {
  item: Item;
  place: Place | null;
  score: number;
  strength: 'strong' | 'weak';
  reasons: string[];
}

export type SearchStatus = 'ok' | 'no_match' | 'needs_rephrase' | 'smalltalk';

export interface SearchResult {
  query: ParsedQuery;
  status: SearchStatus;
  hits: SearchHit[];
  /** For list_location: the places that matched. */
  places: Place[];
}

const ROOM_TO_PLACE_CONCEPT: Record<RoomId, string[]> = {
  bedroom: ['bedroom'],
  kids_room: ['kids_room', 'bedroom'],
  majlis: ['majlis'],
  living: ['living'],
  kitchen: ['kitchen'],
  bathroom: ['bathroom'],
  office: ['desk'],
  storage: ['storage'],
  garage: ['garage'],
  roof: ['roof'],
  car: ['car'],
  other: [],
};

interface IndexedItem {
  doc: SearchDoc;
  /** What the item IS: the head noun of its name, its aliases and tags. */
  primary: Set<string>;
  /** Concepts that only modify the name ("شاحن لابتوب": laptop is secondary). */
  secondary: Set<string>;
  tokens: string[];
  placeConcepts: Set<string>;
  placeTokens: string[];
}

interface IndexedPlace {
  place: Place;
  concepts: Set<string>;
  tokens: string[];
}

function indexPlace(place: Place, lex: CompiledLexicon): IndexedPlace {
  const text = [place.roomLabel ?? '', place.spot, place.note ?? ''].join(' ');
  const ex = extractConcepts(text, lex);
  const concepts = new Set([...ex.places, ...ROOM_TO_PLACE_CONCEPT[place.room]]);
  return { place, concepts, tokens: ex.tokens };
}

/**
 * Builds a reusable index. Items are few (hundreds to a few thousand per user),
 * so an in-memory index rebuilt on change is fast and works fully offline.
 */
export class SearchIndex {
  private items: IndexedItem[] = [];
  private places = new Map<string, IndexedPlace>();

  constructor(private lex: CompiledLexicon) {}

  rebuild(docs: SearchDoc[], allPlaces: Place[]): void {
    this.places.clear();
    for (const p of allPlaces) if (!p.deletedAt) this.places.set(p.id, indexPlace(p, this.lex));
    this.items = docs
      .filter((d) => !d.item.deletedAt)
      .map((doc) => {
        const { item } = doc;
        const primary = new Set<string>(item.tags);
        const secondary = new Set<string>();
        const tokens = new Set<string>();
        const addText = (text: string, headOnly: boolean) => {
          const ex = extractConcepts(text, this.lex);
          ex.items.forEach((c, i) => (i === 0 || !headOnly ? primary : secondary).add(c));
          ex.tokens.forEach((t) => tokens.add(t));
        };
        addText(item.name, true);
        if (item.nameEn) addText(item.nameEn, true);
        for (const k of item.keywords) addText(k, true);
        if (item.notes) {
          const ex = extractConcepts(item.notes, this.lex);
          ex.items.forEach((c) => secondary.add(c));
          ex.tokens.forEach((t) => tokens.add(t));
        }
        for (const c of primary) secondary.delete(c);
        const ip = doc.place ? (this.places.get(doc.place.id) ?? indexPlace(doc.place, this.lex)) : null;
        return {
          doc,
          primary,
          secondary,
          tokens: [...tokens],
          placeConcepts: ip?.concepts ?? new Set<string>(),
          placeTokens: ip?.tokens ?? [],
        };
      });
  }

  get size(): number {
    return this.items.length;
  }

  search(query: ParsedQuery, now: Date = new Date()): SearchResult {
    if (query.intent === 'smalltalk') return { query, status: 'smalltalk', hits: [], places: [] };
    if (query.intent === 'unknown' || query.confidence < CONFIDENCE_FLOOR) {
      // Still try free words: a bare custom item name ("الدباسة") is a valid search.
      if (query.itemTerms.length === 0) return { query, status: 'needs_rephrase', hits: [], places: [] };
      const hits = this.findItems(query, now).filter((h) => h.strength === 'strong');
      return { query, status: hits.length ? 'ok' : 'needs_rephrase', hits, places: [] };
    }
    switch (query.intent) {
      case 'list_location':
        return this.listLocation(query);
      case 'recent':
        return this.recent(query, now);
      case 'find_item':
      case 'item_history': {
        const hits = this.findItems(query, now);
        return { query, status: hits.length ? 'ok' : 'no_match', hits, places: [] };
      }
    }
  }

  private findItems(query: ParsedQuery, now: Date): SearchHit[] {
    const wanted = [...query.itemConcepts, ...query.tagConcepts];
    const wantedCategories = new Set(query.itemConcepts.map((c) => this.lex.categoryOf.get(c)).filter(Boolean));
    const range = query.time ? timeRange(query.time, now) : null;
    const hits: SearchHit[] = [];

    for (const ix of this.items) {
      const { item } = ix.doc;
      let score = 0;
      const reasons: string[] = [];
      let strongMatch = false;

      for (const c of wanted) {
        const meta = this.lex.meta.get(c);
        if (ix.primary.has(c)) {
          score += 6;
          strongMatch = true;
          reasons.push(`concept:${c}`);
        } else if ([...ix.primary].some((p) => this.lex.meta.get(p)?.parent === c)) {
          // asked for "keys", item is a car key
          score += 5;
          strongMatch = true;
          reasons.push(`child:${c}`);
        } else if (meta?.generic && item.category === meta.category) {
          // asked for "clothes", item is any clothing
          score += 4;
          strongMatch = true;
          reasons.push(`generic:${c}`);
        } else if (ix.secondary.has(c)) {
          score += 2;
          reasons.push(`related:${c}`);
        } else if (meta?.parent && ix.primary.has(meta.parent)) {
          score += 1.5;
          reasons.push(`parent:${meta.parent}`);
        }
      }
      for (const term of query.itemTerms) {
        if (ix.tokens.includes(term)) {
          score += 5;
          strongMatch = true;
          reasons.push(`term:${term}`);
        } else if (ix.tokens.some((t) => fuzzyEquals(t, term))) {
          // A typo-level match alone is only a suggestion, never a confident answer.
          score += term.length >= 5 ? 3 : 1.5;
          if (term.length >= 5 && wanted.length > 0) strongMatch = true;
          reasons.push(`fuzzy:${term}`);
        }
      }
      if (!strongMatch && wantedCategories.has(item.category)) {
        score += 1.5;
        reasons.push(`category:${item.category}`);
      }
      if (score === 0) continue;

      if (query.colors.length > 0) {
        if (item.color && query.colors.includes(item.color)) {
          score += 2.5;
          reasons.push(`color:${item.color}`);
        } else if (item.color) {
          score -= 2;
        }
      }
      for (const pc of query.placeConcepts) {
        if (ix.placeConcepts.has(pc)) {
          score += 2;
          reasons.push(`place:${pc}`);
        }
      }
      if (range) {
        const t = Date.parse(item.lastMovedAt ?? item.createdAt);
        if (t >= range.from && t < range.to) {
          score += 2.5;
          reasons.push('time');
        } else {
          score -= 1;
        }
      }
      if (item.favorite) score += 0.2;
      hits.push({ item, place: ix.doc.place, score, strength: strongMatch ? 'strong' : 'weak', reasons });
    }

    hits.sort((a, b) => b.score - a.score || recency(b.item) - recency(a.item));
    const strong = hits.filter((h) => h.strength === 'strong');
    // Category-only matches are shown as "maybe you meant" only when nothing strong exists.
    return (strong.length > 0 ? strong : hits).slice(0, 20);
  }

  private listLocation(query: ParsedQuery): SearchResult {
    const scored: { ip: IndexedPlace; score: number }[] = [];
    for (const ip of this.places.values()) {
      let score = 0;
      for (const pc of query.placeConcepts) if (ip.concepts.has(pc)) score += 5;
      for (const term of query.placeTerms) {
        if (ip.tokens.includes(term)) score += 2;
        else if (ip.tokens.some((t) => fuzzyEquals(t, term))) score += 1;
      }
      if (score > 0) scored.push({ ip, score });
    }
    if (scored.length === 0) return { query, status: 'no_match', hits: [], places: [] };
    const best = Math.max(...scored.map((s) => s.score));
    const chosen = scored.filter((s) => s.score >= best * 0.75 && s.score >= 3).map((s) => s.ip.place);
    const ids = new Set(chosen.map((p) => p.id));
    const hits: SearchHit[] = this.items
      .filter((ix) => ix.doc.place && ids.has(ix.doc.place.id))
      .map((ix) => ({ item: ix.doc.item, place: ix.doc.place, score: best, strength: 'strong' as const, reasons: ['in_place'] }))
      .sort((a, b) => recency(b.item) - recency(a.item));
    return { query, status: chosen.length ? 'ok' : 'no_match', hits, places: chosen };
  }

  private recent(query: ParsedQuery, now: Date): SearchResult {
    const range = query.time ? timeRange(query.time, now) : null;
    const hits = this.items
      .filter((ix) => {
        if (!range) return true;
        const t = recency(ix.doc.item);
        return t >= range.from && t < range.to;
      })
      .sort((a, b) => recency(b.doc.item) - recency(a.doc.item))
      .slice(0, 12)
      .map((ix) => ({ item: ix.doc.item, place: ix.doc.place, score: 1, strength: 'strong' as const, reasons: ['recent'] }));
    return { query, status: hits.length ? 'ok' : 'no_match', hits, places: [] };
  }
}

function recency(item: Item): number {
  return Date.parse(item.lastMovedAt ?? item.createdAt);
}

const DAY = 24 * 60 * 60 * 1000;

export function timeRange(ref: TimeRefId, now: Date): { from: number; to: number } {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const t0 = startOfToday.getTime();
  switch (ref) {
    case 'today':
      return { from: t0, to: t0 + DAY };
    case 'yesterday':
      return { from: t0 - DAY, to: t0 };
    case 'day_before':
      return { from: t0 - 2 * DAY, to: t0 - DAY };
    case 'this_week':
      return { from: t0 - 6 * DAY, to: t0 + DAY };
    case 'last_week':
      return { from: t0 - 14 * DAY, to: t0 - 6 * DAY };
    case 'recent':
      return { from: now.getTime() - 3 * 60 * 60 * 1000, to: now.getTime() + 1 };
  }
}

/** Simple text filter for the "all items" screen; same normalization as voice search. */
export function matchesText(item: Item, place: Place | null, text: string): boolean {
  const q = normalizeArabic(text);
  if (!q) return true;
  const hay = normalizeArabic(
    [item.name, item.nameEn ?? '', ...item.keywords, place?.spot ?? '', place?.roomLabel ?? ''].join(' '),
  );
  return q.split(' ').every((w) => hay.includes(w));
}
