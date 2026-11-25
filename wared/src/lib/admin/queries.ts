import 'server-only';
import type { MediaOption } from '@/components/admin/MediaUploader';
import { storagePublicUrl } from '@/lib/env';
import { getSessionClient } from '@/lib/supabase/server';

/* Dashboard reads. They use the staff member's session, so RLS decides what each role can see. */

type Row = Record<string, unknown>;

async function db() {
  return getSessionClient();
}

export async function listTable(table: string, columns: string, options: { status?: string; order?: string; limit?: number; filter?: [string, string] } = {}) {
  const client = await db();
  if (!client) return [] as Row[];
  let query = client.from(table).select(columns).order(options.order ?? 'updated_at', { ascending: false }).limit(options.limit ?? 200);
  if (options.status) query = query.eq('status', options.status);
  if (options.filter) query = query.eq(options.filter[0], options.filter[1]);
  const { data, error } = await query;
  if (error) console.error(`[admin:${table}]`, error.message);
  return (data ?? []) as unknown as Row[];
}

export async function getRow(table: string, id: string, columns = '*') {
  const client = await db();
  if (!client || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data, error } = await client.from(table).select(columns).eq('id', id).maybeSingle();
  if (error) console.error(`[admin:${table}:get]`, error.message);
  return (data ?? null) as Row | null;
}

export async function mediaOptions(): Promise<Record<'image' | 'audio' | 'video', MediaOption[]>> {
  const rows = await listTable('media_assets', 'id, bucket, path, kind, original_name, alt, created_at', { order: 'created_at', limit: 400 });
  const out: Record<'image' | 'audio' | 'video', MediaOption[]> = { image: [], audio: [], video: [] };
  for (const r of rows) {
    const kind = r.kind as 'image' | 'audio' | 'video';
    const url = storagePublicUrl(String(r.bucket), String(r.path));
    if (!url) continue;
    out[kind].push({ id: String(r.id), kind, url, label: String(r.alt || r.original_name || r.path) });
  }
  return out;
}

export async function programOptions() {
  const rows = await listTable('podcasts', 'id, title', { order: 'sort_order' });
  return rows.map((r) => ({ value: String(r.id), label: String(r.title) }));
}

export async function guestOptions() {
  const rows = await listTable('guests', 'id, name', { order: 'name', limit: 1000 });
  return rows.map((r) => ({ value: String(r.id), label: String(r.name) }));
}

export async function episodeOptions() {
  const rows = await listTable('episodes', 'id, title, number', { order: 'published_at', limit: 1000 });
  return rows.map((r) => ({ value: String(r.id), label: `${r.number ? `${r.number}. ` : ''}${r.title}` }));
}

export async function categoryOptions() {
  const rows = await listTable('categories', 'id, name', { order: 'sort_order' });
  return rows.map((r) => ({ value: String(r.id), label: String(r.name) }));
}

export async function count(table: string, eq: Record<string, string> = {}): Promise<number> {
  const client = await db();
  if (!client) return 0;
  let query = client.from(table).select('*', { count: 'exact', head: true });
  for (const [key, value] of Object.entries(eq)) query = query.eq(key, value);
  const { count: n } = await query;
  return n ?? 0;
}

export interface AnalyticsOverview {
  since: string;
  totals: { page_views: number; plays: number; completions: number; listeners: number; shares: number; newsletter_signups: number };
  daily: { day: string; page_views: number; plays: number }[];
  top_episodes: { id: string; slug: string; title: string; plays: number; completions: number }[];
  top_paths: { path: string; views: number }[];
  devices: Record<string, number>;
  referrers: { host: string; visits: number }[];
}

export async function analyticsOverview(days: number): Promise<AnalyticsOverview | null> {
  const client = await db();
  if (!client) return null;
  const { data, error } = await client.rpc('analytics_overview', { p_days: days });
  if (error) {
    console.error('[admin:analytics]', error.message);
    return null;
  }
  return data as AnalyticsOverview;
}
