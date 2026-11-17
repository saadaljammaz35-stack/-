import { extractConcepts, parseQuery, type CompiledLexicon, type ParsedQuery } from '@/features/dialect/parser';
import { canonicalWord } from '@/features/dialect/normalize';
import type { SearchIndex, SearchResult } from '@/features/search/searchEngine';

import { understandQuery, type AiGate } from './ai/aiClient';

export interface SearchOptions {
  index: SearchIndex;
  lex: CompiledLexicon;
  /** Cloud fallback for phrasing the local rules did not understand (opt-in). */
  ai?: AiGate | null;
  now?: Date;
}

export interface SearchOutcome extends SearchResult {
  usedAi: boolean;
}

/** Turns an AI restructuring of the question back into a ParsedQuery over the local lexicon. */
export function queryFromAi(
  original: ParsedQuery,
  ai: Awaited<ReturnType<typeof understandQuery>>,
  lex: CompiledLexicon,
): ParsedQuery {
  const items = extractConcepts(ai.itemWords.join(' '), lex);
  const places = extractConcepts(ai.placeWords.join(' '), lex);
  const tagIds = items.items.filter((c) => lex.meta.get(c)?.tag);
  return {
    ...original,
    intent: ai.intent,
    confidence: ai.intent === 'unknown' ? 0.2 : 0.75,
    itemConcepts: items.items.filter((c) => !tagIds.includes(c)),
    tagConcepts: tagIds,
    placeConcepts: places.places,
    colors: ai.color ? [ai.color] : original.colors,
    time: ai.time ?? original.time,
    itemTerms: ai.itemWords.map(canonicalWord).filter(Boolean),
    placeTerms: ai.placeWords.map(canonicalWord).filter(Boolean),
    source: 'ai',
  };
}

/**
 * Search pipeline: local rules first (instant, offline, private). Only when they
 * cannot understand the question, and the user allowed cloud AI, the text (never
 * audio) is sent for restructuring. Results always come from the user's own data.
 */
export async function runSearch(text: string, opts: SearchOptions): Promise<SearchOutcome> {
  const now = opts.now ?? new Date();
  const q = parseQuery(text, opts.lex);
  const local = opts.index.search(q, now);
  // Descriptive questions ("الشي اللي اشبك فيه الاوراق") leave several unknown words behind.
  const descriptive = q.itemTerms.length >= 2;
  const unsure = local.status === 'needs_rephrase' || (local.status === 'no_match' && (q.confidence < 0.7 || descriptive));
  if (!unsure || !opts.ai) return { ...local, usedAi: false };
  try {
    const ai = await understandQuery(opts.ai, text);
    if (ai.intent === 'unknown') return { ...local, usedAi: true };
    const aiResult = opts.index.search(queryFromAi(q, ai, opts.lex), now);
    return aiResult.hits.length > 0 || aiResult.places.length > 0 ? { ...aiResult, usedAi: true } : { ...local, usedAi: true };
  } catch {
    return { ...local, usedAi: false };
  }
}
