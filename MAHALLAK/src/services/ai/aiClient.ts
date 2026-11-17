import type { SupabaseClient } from '@supabase/supabase-js';

import { isCategoryId, isColorId, type CategoryId, type ColorId } from '@/domain/categories';

/**
 * Client for the AI Edge Functions. API keys never reach the device: the app
 * calls Supabase Edge Functions with the user's session, and the functions call
 * the AI provider with server-side secrets, enforce quotas and check consent.
 */

export type AiErrorCode =
  | 'not_signed_in'
  | 'consent_required'
  | 'offline'
  | 'quota_exceeded'
  | 'not_configured'
  | 'not_entitled'
  | 'rejected'
  | 'failed';

export class AiError extends Error {
  constructor(public code: AiErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'AiError';
  }
}

export interface RecognizedItem {
  nameAr: string;
  nameEn: string;
  category: CategoryId;
  color: ColorId | null;
  keywords: string[];
  /** 0..1 as reported by the model; the UI always lets the user edit. */
  confidence: number;
  /** Normalized bounding box (0..1), only for multi-item scans. */
  box?: { x: number; y: number; w: number; h: number } | null;
}

export interface UnderstoodQuery {
  intent: 'find_item' | 'list_location' | 'item_history' | 'recent' | 'unknown';
  itemWords: string[];
  placeWords: string[];
  color: ColorId | null;
  time: 'today' | 'yesterday' | 'day_before' | 'this_week' | 'last_week' | 'recent' | null;
}

const str = (v: unknown, max = 120) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num01 = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);
const strList = (v: unknown, max = 12) =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').map((x) => x.trim().slice(0, 60)).filter(Boolean).slice(0, max) : [];

export function parseRecognizedItem(raw: unknown): RecognizedItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const nameAr = str(r.name_ar);
  const nameEn = str(r.name_en);
  if (!nameAr && !nameEn) return null;
  const box = r.box && typeof r.box === 'object' ? (r.box as Record<string, unknown>) : null;
  return {
    nameAr: nameAr || nameEn,
    nameEn,
    category: isCategoryId(r.category) ? r.category : 'other',
    color: isColorId(r.color) ? r.color : null,
    keywords: strList(r.keywords),
    confidence: num01(r.confidence),
    box: box ? { x: num01(box.x), y: num01(box.y), w: num01(box.w), h: num01(box.h) } : null,
  };
}

const INTENTS = new Set(['find_item', 'list_location', 'item_history', 'recent', 'unknown']);
const TIMES = new Set(['today', 'yesterday', 'day_before', 'this_week', 'last_week', 'recent']);

export function parseUnderstoodQuery(raw: unknown): UnderstoodQuery | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!INTENTS.has(String(r.intent))) return null;
  return {
    intent: r.intent as UnderstoodQuery['intent'],
    itemWords: strList(r.item_words, 6),
    placeWords: strList(r.place_words, 6),
    color: isColorId(r.color) ? r.color : null,
    time: TIMES.has(String(r.time)) ? (r.time as UnderstoodQuery['time']) : null,
  };
}

export interface AiGate {
  client: SupabaseClient | null;
  signedIn: boolean;
  consent: boolean;
  online: boolean;
}

async function invoke<T>(gate: AiGate, fn: string, body: Record<string, unknown>): Promise<T> {
  if (!gate.client) throw new AiError('not_configured');
  if (!gate.signedIn) throw new AiError('not_signed_in');
  if (!gate.consent) throw new AiError('consent_required');
  if (!gate.online) throw new AiError('offline');
  const { data, error } = await gate.client.functions.invoke(fn, { body });
  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status;
    if (status === 429) throw new AiError('quota_exceeded');
    if (status === 501) throw new AiError('not_configured');
    if (status === 402) throw new AiError('not_entitled');
    if (status === 403) throw new AiError('consent_required');
    if (status === 422) throw new AiError('rejected');
    throw new AiError('failed', error.message);
  }
  return data as T;
}

export async function recognizeItem(gate: AiGate, imageBase64: string, locale: string): Promise<RecognizedItem> {
  const data = await invoke<unknown>(gate, 'ai-recognize-item', { image: imageBase64, media_type: 'image/jpeg', locale });
  const parsed = parseRecognizedItem(data);
  if (!parsed) throw new AiError('failed', 'invalid response');
  return parsed;
}

export async function detectItems(gate: AiGate, imageBase64: string, locale: string): Promise<RecognizedItem[]> {
  const data = await invoke<{ items?: unknown[] }>(gate, 'ai-detect-items', { image: imageBase64, media_type: 'image/jpeg', locale });
  return (data?.items ?? []).map(parseRecognizedItem).filter((x): x is RecognizedItem => x !== null);
}

export async function understandQuery(gate: AiGate, text: string): Promise<UnderstoodQuery> {
  const data = await invoke<unknown>(gate, 'ai-understand-query', { text: text.slice(0, 300) });
  const parsed = parseUnderstoodQuery(data);
  if (!parsed) throw new AiError('failed', 'invalid response');
  return parsed;
}

/** Returns a PNG (base64) with the background removed, or throws so the caller keeps the original. */
export async function removeBackground(gate: AiGate, imageBase64: string): Promise<string> {
  const data = await invoke<{ image_png_base64?: string }>(gate, 'remove-background', { image: imageBase64 });
  if (!data?.image_png_base64) throw new AiError('failed', 'no image');
  return data.image_png_base64;
}

/** Items the scan is sure about are pre-selected; uncertain ones need an explicit tap to be saved. */
export const ROOM_SCAN_AUTO_SELECT = 0.75;
export function preselect(items: RecognizedItem[]): (RecognizedItem & { selected: boolean })[] {
  return items.map((i) => ({ ...i, selected: i.confidence >= ROOM_SCAN_AUTO_SELECT }));
}
