'use server';

import { z } from 'zod';
import { staffFor, type Staff } from '@/lib/admin/auth';
import { revalidateContent } from '@/lib/admin/revalidate';
import { readingMinutes } from '@/lib/format';
import { parseChapters } from '@/lib/parsers/chapters';
import { detectFormat, parseTranscript, segmentsToPlainText } from '@/lib/parsers/transcript';
import { getSessionClient } from '@/lib/supabase/server';
import {
  articleSchema,
  categorySchema,
  clipSchema,
  dbErrorMessage,
  episodeSchema,
  guestSchema,
  programSchema,
  riyadhToIso,
  zodFieldErrors,
  type AdminResult,
} from '@/lib/validation/admin';

type Status = z.infer<typeof episodeSchema>['status'];

const DENIED: AdminResult = { ok: false, error: 'ليست لديك صلاحية لهذا الإجراء.' };
const UNAVAILABLE: AdminResult = { ok: false, error: 'قاعدة البيانات غير مهيأة. راجع إعدادات البيئة.' };

/** Normalises status and publish time: "published" without a date means now, "scheduled" needs a date. */
function resolvePublish(status: Status, local: string | null, staff: Staff): { status: Status; published_at: string | null } | AdminResult {
  const iso = riyadhToIso(local);
  if ((status === 'published' || status === 'scheduled') && !staff.permissions.includes('content.publish')) {
    return { ok: false, error: 'النشر والجدولة من صلاحيات المحرر وما فوق. احفظ كمسودة أو أرسل للمراجعة.' };
  }
  if (status === 'published') {
    if (iso && new Date(iso).getTime() > Date.now() + 60_000) return { status: 'scheduled', published_at: iso };
    return { status, published_at: iso ?? new Date().toISOString() };
  }
  if (status === 'scheduled') {
    if (!iso) return { ok: false, error: 'حدد تاريخ ووقت النشر للجدولة.', fieldErrors: { published_at: 'مطلوب للجدولة' } };
    return { status, published_at: iso };
  }
  return { status, published_at: iso };
}

function isResult(value: unknown): value is AdminResult {
  return typeof value === 'object' && value !== null && 'ok' in value;
}

async function context(permission: Parameters<typeof staffFor>[0]) {
  const staff = await staffFor(permission);
  const db = await getSessionClient();
  return { staff, db };
}

function invalid(error: z.ZodError): AdminResult {
  return { ok: false, error: 'راجع الحقول المظللة.', fieldErrors: zodFieldErrors(error) };
}

// ---------------------------------------------------------------------------
// Programs
// ---------------------------------------------------------------------------

export async function saveProgram(input: unknown): Promise<AdminResult> {
  const { staff, db } = await context('content.edit_any');
  if (!staff) return DENIED;
  if (!db) return UNAVAILABLE;
  const parsed = programSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { id, published_at: local, ...data } = parsed.data;
  const publish = resolvePublish(data.status, local, staff);
  if (isResult(publish)) return publish;
  const row = { ...data, ...publish, sort_order: data.sort_order ?? 0, updated_by: staff.id };
  const query = id
    ? db.from('podcasts').update(row).eq('id', id).select('id').single()
    : db.from('podcasts').insert({ ...row, created_by: staff.id }).select('id').single();
  const { data: saved, error } = await query;
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidateContent();
  return { ok: true, id: saved.id, message: 'تم الحفظ', redirectTo: id ? undefined : `/admin/programs/${saved.id}` };
}

// ---------------------------------------------------------------------------
// Episodes (with chapters, transcript and guests)
// ---------------------------------------------------------------------------

export async function saveEpisode(input: unknown): Promise<AdminResult> {
  const { staff, db } = await context('content.edit_any');
  if (!staff) return DENIED;
  if (!db) return UNAVAILABLE;
  const parsed = episodeSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { id, published_at: local, chapters_text, transcript_text, guest_ids, ...data } = parsed.data;
  const publish = resolvePublish(data.status, local, staff);
  if (isResult(publish)) return publish;

  const chapters = chapters_text ? parseChapters(chapters_text) : { items: [], errors: [] };
  if (chapters.errors.length > 0) {
    return { ok: false, error: 'بعض أسطر الفصول غير مفهومة.', fieldErrors: { chapters_text: `السطر ${chapters.errors.map((e) => e.line).join('، ')}: استخدم صيغة 00:00 العنوان` } };
  }
  if ((publish.status === 'published' || publish.status === 'scheduled') && !data.audio_asset_id && !data.audio_url) {
    return { ok: false, error: 'لا يمكن نشر حلقة بدون ملف صوتي أو رابط صوت.', fieldErrors: { audio_asset_id: 'اختر ملفًا صوتيًا أو أضف رابطًا' } };
  }

  // Copy technical details from the uploaded audio file (used by the RSS enclosure).
  let audioMeta: { audio_mime: string | null; audio_bytes: number | null; duration_seconds: number | null } = {
    audio_mime: null,
    audio_bytes: null,
    duration_seconds: data.duration_seconds,
  };
  if (data.audio_asset_id) {
    const { data: asset } = await db.from('media_assets').select('mime_type, bytes, duration_seconds, kind').eq('id', data.audio_asset_id).maybeSingle();
    if (!asset || asset.kind !== 'audio') return { ok: false, error: 'الملف الصوتي المختار غير موجود.', fieldErrors: { audio_asset_id: 'اختر ملفًا صوتيًا' } };
    audioMeta = {
      audio_mime: asset.mime_type === 'audio/x-m4a' ? 'audio/mp4' : asset.mime_type,
      audio_bytes: asset.bytes,
      duration_seconds: data.duration_seconds ?? asset.duration_seconds,
    };
  }

  const row = { ...data, ...audioMeta, ...publish, updated_by: staff.id };
  const { data: saved, error } = id
    ? await db.from('episodes').update(row).eq('id', id).select('id').single()
    : await db.from('episodes').insert({ ...row, created_by: staff.id }).select('id').single();
  if (error) return { ok: false, error: dbErrorMessage(error) };
  const episodeId = saved.id as string;

  // Replace chapters.
  const { error: chapterDeleteError } = await db.from('episode_chapters').delete().eq('episode_id', episodeId);
  if (chapterDeleteError) return { ok: false, error: dbErrorMessage(chapterDeleteError) };
  if (chapters.items.length > 0) {
    const { error: chapterError } = await db.from('episode_chapters').insert(
      chapters.items.map((c, position) => ({ episode_id: episodeId, start_seconds: c.startSeconds, title: c.title, title_en: c.titleEn, position })),
    );
    if (chapterError) return { ok: false, error: dbErrorMessage(chapterError) };
  }

  // Transcript (Arabic): parsed from plain text, WebVTT or SRT.
  if (transcript_text) {
    const format = detectFormat(transcript_text);
    const segments = parseTranscript(transcript_text, format);
    const { error: transcriptError } = await db.from('transcripts').upsert(
      { episode_id: episodeId, locale: 'ar', source_format: format, segments, plain_text: segmentsToPlainText(segments) },
      { onConflict: 'episode_id,locale' },
    );
    if (transcriptError) return { ok: false, error: dbErrorMessage(transcriptError) };
  } else {
    await db.from('transcripts').delete().eq('episode_id', episodeId).eq('locale', 'ar');
  }

  // Guests.
  const { error: guestDeleteError } = await db.from('episode_guests').delete().eq('episode_id', episodeId);
  if (guestDeleteError) return { ok: false, error: dbErrorMessage(guestDeleteError) };
  if (guest_ids.length > 0) {
    const { error: guestError } = await db
      .from('episode_guests')
      .insert([...new Set(guest_ids)].map((guest_id, position) => ({ episode_id: episodeId, guest_id, position })));
    if (guestError) return { ok: false, error: dbErrorMessage(guestError) };
  }

  revalidateContent();
  return {
    ok: true,
    id: episodeId,
    message: publish.status === 'scheduled' ? 'تمت الجدولة. ستظهر الحلقة تلقائيًا في موعدها.' : 'تم الحفظ',
    redirectTo: id ? undefined : `/admin/episodes/${episodeId}`,
  };
}

// ---------------------------------------------------------------------------
// Articles (writers may create and edit their own drafts)
// ---------------------------------------------------------------------------

export async function saveArticle(input: unknown): Promise<AdminResult> {
  const { staff, db } = await context('content.create');
  if (!staff) return DENIED;
  if (!db) return UNAVAILABLE;
  const parsed = articleSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { id, published_at: local, ...data } = parsed.data;
  const publish = resolvePublish(data.status, local, staff);
  if (isResult(publish)) return publish;
  if ((publish.status === 'published' || publish.status === 'scheduled') && data.body.trim().length < 50) {
    return { ok: false, error: 'النص قصير جدًا للنشر.', fieldErrors: { body: 'اكتب نص المقال قبل النشر' } };
  }
  const row = {
    ...data,
    ...publish,
    author_name: data.author_name ?? (staff.fullName || null),
    reading_minutes: readingMinutes(data.body),
    updated_by: staff.id,
  };
  const { data: saved, error } = id
    ? await db.from('articles').update(row).eq('id', id).select('id').maybeSingle()
    : await db.from('articles').insert({ ...row, created_by: staff.id, author_id: staff.id }).select('id').single();
  if (error) return { ok: false, error: dbErrorMessage(error) };
  if (!saved) return DENIED;
  revalidateContent();
  return { ok: true, id: saved.id, message: 'تم الحفظ', redirectTo: id ? undefined : `/admin/articles/${saved.id}` };
}

// ---------------------------------------------------------------------------
// Guests, clips, categories
// ---------------------------------------------------------------------------

export async function saveGuest(input: unknown): Promise<AdminResult> {
  const { staff, db } = await context('content.edit_any');
  if (!staff) return DENIED;
  if (!db) return UNAVAILABLE;
  const parsed = guestSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { id, published_at: local, ...data } = parsed.data;
  const publish = resolvePublish(data.status, local, staff);
  if (isResult(publish)) return publish;
  const row = { ...data, ...publish, updated_by: staff.id };
  const { data: saved, error } = id
    ? await db.from('guests').update(row).eq('id', id).select('id').single()
    : await db.from('guests').insert({ ...row, created_by: staff.id }).select('id').single();
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidateContent();
  return { ok: true, id: saved.id, message: 'تم الحفظ', redirectTo: id ? undefined : `/admin/guests/${saved.id}` };
}

export async function saveClip(input: unknown): Promise<AdminResult> {
  const { staff, db } = await context('content.edit_any');
  if (!staff) return DENIED;
  if (!db) return UNAVAILABLE;
  const parsed = clipSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { id, published_at: local, ...data } = parsed.data;
  const publish = resolvePublish(data.status, local, staff);
  if (isResult(publish)) return publish;
  const row = { ...data, ...publish, updated_by: staff.id };
  const { data: saved, error } = id
    ? await db.from('clips').update(row).eq('id', id).select('id').single()
    : await db.from('clips').insert({ ...row, created_by: staff.id }).select('id').single();
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidateContent();
  return { ok: true, id: saved.id, message: 'تم الحفظ', redirectTo: id ? undefined : `/admin/clips/${saved.id}` };
}

export async function saveCategory(input: unknown): Promise<AdminResult> {
  const { staff, db } = await context('content.edit_any');
  if (!staff) return DENIED;
  if (!db) return UNAVAILABLE;
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { id, ...data } = parsed.data;
  const row = { ...data, sort_order: data.sort_order ?? 0 };
  const { error } = id ? await db.from('categories').update(row).eq('id', id) : await db.from('categories').insert(row);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidateContent();
  return { ok: true, message: 'تم الحفظ' };
}

// ---------------------------------------------------------------------------
// Deletion
// ---------------------------------------------------------------------------

const DELETABLE = {
  podcasts: '/admin/programs',
  episodes: '/admin/episodes',
  articles: '/admin/articles',
  guests: '/admin/guests',
  clips: '/admin/clips',
  categories: '/admin/categories',
} as const;

export async function deleteContent(table: keyof typeof DELETABLE, id: string): Promise<AdminResult> {
  if (!(table in DELETABLE) || !z.uuid().safeParse(id).success) return { ok: false, error: 'طلب غير صالح' };
  // Writers may delete their own article drafts (RLS decides); everything else needs content.delete.
  const { staff, db } = await context(table === 'articles' ? 'content.create' : 'content.delete');
  if (!staff) return DENIED;
  if (!db) return UNAVAILABLE;
  const { data, error } = await db.from(table).delete().eq('id', id).select('id');
  if (error) return { ok: false, error: dbErrorMessage(error) };
  if (!data || data.length === 0) return DENIED;
  revalidateContent();
  return { ok: true, message: 'تم الحذف', redirectTo: DELETABLE[table] };
}
