'use client';

const LISTENER_KEY = 'wared:lid';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string | null | undefined): value is string {
  return Boolean(value && UUID.test(value));
}

/** Anonymous, random listener id kept in this browser only (no cookie). */
export function getListenerId(): string | null {
  try {
    let id = localStorage.getItem(LISTENER_KEY);
    if (!isUuid(id)) {
      id = crypto.randomUUID();
      localStorage.setItem(LISTENER_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

function privacySignal(): boolean {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return nav.globalPrivacyControl === true || navigator.doNotTrack === '1';
}

export interface ClientEvent {
  type: 'page_view' | 'play_start' | 'play_progress' | 'play_complete' | 'share' | 'newsletter_signup' | 'outbound_click';
  path?: string;
  locale?: 'ar' | 'en';
  episodeId?: string;
  articleId?: string;
  clipId?: string;
  value?: number;
  referrer?: string;
}

export function sendEvent(event: ClientEvent): void {
  if (typeof window === 'undefined') return;
  if (process.env.NEXT_PUBLIC_DEMO_CONTENT === '1') return;
  const payload: Record<string, unknown> = { ...event };
  for (const key of ['episodeId', 'articleId', 'clipId'] as const) {
    if (payload[key] && !isUuid(payload[key] as string)) delete payload[key];
  }
  if (!privacySignal()) {
    const lid = getListenerId();
    if (lid) payload.listenerId = lid;
  }
  const body = JSON.stringify(payload);
  try {
    if (navigator.sendBeacon?.('/api/events', new Blob([body], { type: 'application/json' }))) return;
  } catch {
    // fall through to fetch
  }
  void fetch('/api/events', { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(() => {});
}

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or blocked: progress just won't persist
  }
}
