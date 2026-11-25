import type { FieldConfig } from '@/components/admin/EntityForm';
import { STATUS_LABELS } from './permissions';

/* Field layouts for the dashboard editors. Pure data, shared by server pages and the client form. */

export function statusOptions(canPublish: boolean) {
  const all = Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }));
  return canPublish ? all : all.filter((o) => o.value === 'draft' || o.value === 'review');
}

const publishFields = (canPublish: boolean): FieldConfig[] => [
  { type: 'section', title: 'النشر', description: 'المجدول يظهر تلقائيًا للجمهور عند حلول موعده (بتوقيت الرياض).' },
  { type: 'select', name: 'status', label: 'الحالة', options: statusOptions(canPublish) },
  { type: 'datetime', name: 'published_at', label: 'تاريخ ووقت النشر', hint: 'اتركه فارغًا للنشر الآن عند اختيار «منشور».' },
];

export function programFields(canPublish: boolean): FieldConfig[] {
  return [
    { type: 'section', title: 'الأساسيات' },
    { type: 'text', name: 'title', label: 'اسم البرنامج' },
    { type: 'text', name: 'title_en', label: 'الاسم بالإنجليزية (اختياري)', dir: 'ltr' },
    { type: 'text', name: 'slug', label: 'الرابط المختصر (slug)', dir: 'ltr', hint: 'أحرف إنجليزية صغيرة وأرقام وشرطات. يظهر في الرابط: /programs/slug' },
    {
      type: 'select',
      name: 'kind',
      label: 'النوع',
      options: [
        { value: 'podcast', label: 'بودكاست' },
        { value: 'series', label: 'سلسلة' },
        { value: 'show', label: 'برنامج' },
      ],
    },
    { type: 'text', name: 'tagline', label: 'سطر تعريفي', wide: true },
    { type: 'text', name: 'tagline_en', label: 'السطر التعريفي بالإنجليزية', dir: 'ltr', wide: true },
    { type: 'textarea', name: 'description', label: 'الوصف' },
    { type: 'textarea', name: 'description_en', label: 'الوصف بالإنجليزية', dir: 'ltr' },
    { type: 'text', name: 'hosts', label: 'التقديم', hint: 'أسماء المقدمين كما تظهر في الموقع وخلاصة RSS.' },
    { type: 'number', name: 'sort_order', label: 'ترتيب العرض' },
    { type: 'media', name: 'cover_image_id', label: 'صورة الغلاف', kind: 'image', hint: 'للمنصات الصوتية: صورة مربعة بين 1400 و3000 بكسل.' },
    { type: 'section', title: 'منصات الاستماع وRSS' },
    {
      type: 'select',
      name: 'language',
      label: 'لغة البرنامج',
      options: [
        { value: 'ar', label: 'العربية' },
        { value: 'en', label: 'الإنجليزية' },
      ],
    },
    { type: 'text', name: 'itunes_category', label: 'تصنيف آبل بودكاست', dir: 'ltr', hint: 'مثل: Society & Culture أو Society & Culture | Documentary' },
    { type: 'checkbox', name: 'explicit', label: 'محتوى صريح (Explicit)' },
    { type: 'url', name: 'spotify_url', label: 'رابط سبوتيفاي', placeholder: 'https://open.spotify.com/show/…' },
    { type: 'url', name: 'apple_podcasts_url', label: 'رابط آبل بودكاست', placeholder: 'https://podcasts.apple.com/…' },
    { type: 'url', name: 'youtube_playlist_url', label: 'قائمة يوتيوب', placeholder: 'https://www.youtube.com/playlist?list=…' },
    { type: 'url', name: 'anghami_url', label: 'رابط أنغامي', placeholder: 'https://play.anghami.com/…' },
    ...publishFields(canPublish),
  ];
}

export function episodeFields(canPublish: boolean, programs: { value: string; label: string }[], guests: { value: string; label: string }[]): FieldConfig[] {
  return [
    { type: 'section', title: 'الأساسيات' },
    { type: 'select', name: 'podcast_id', label: 'البرنامج', options: [{ value: '', label: '— اختر —' }, ...programs] },
    { type: 'text', name: 'slug', label: 'الرابط المختصر (slug)', dir: 'ltr', hint: 'مثل: ep-01-desert-stories' },
    { type: 'text', name: 'title', label: 'عنوان الحلقة', wide: true },
    { type: 'text', name: 'title_en', label: 'العنوان بالإنجليزية (اختياري)', dir: 'ltr', wide: true },
    { type: 'number', name: 'number', label: 'رقم الحلقة' },
    { type: 'number', name: 'season', label: 'الموسم' },
    {
      type: 'select',
      name: 'episode_type',
      label: 'نوع الحلقة',
      options: [
        { value: 'full', label: 'حلقة كاملة' },
        { value: 'trailer', label: 'إعلان تشويقي' },
        { value: 'bonus', label: 'حلقة إضافية' },
      ],
    },
    { type: 'checkbox', name: 'is_featured', label: 'حلقة مميزة (تظهر في الرئيسية)' },
    { type: 'textarea', name: 'summary', label: 'وصف قصير', rows: 3 },
    { type: 'textarea', name: 'summary_en', label: 'الوصف القصير بالإنجليزية', rows: 3, dir: 'ltr' },
    { type: 'textarea', name: 'show_notes', label: 'ملاحظات الحلقة', rows: 8, hint: 'يدعم: فقرات، ## عنوان، > اقتباس، - قائمة، **عريض**، [رابط](https://…)' },
    { type: 'textarea', name: 'show_notes_en', label: 'ملاحظات الحلقة بالإنجليزية', rows: 6, dir: 'ltr' },
    { type: 'media', name: 'cover_image_id', label: 'صورة الحلقة', kind: 'image' },
    { type: 'section', title: 'الصوت والفيديو' },
    { type: 'media', name: 'audio_asset_id', label: 'الملف الصوتي', kind: 'audio', hint: 'MP3 أو M4A. يُرفع مباشرة إلى التخزين، ويُستخدم في المشغل وخلاصة RSS.' },
    { type: 'url', name: 'audio_url', label: 'أو رابط صوت خارجي', hint: 'يُستخدم فقط إذا لم تختر ملفًا مرفوعًا.' },
    { type: 'number', name: 'duration_seconds', label: 'المدة بالثواني', hint: 'تُملأ تلقائيًا من الملف المرفوع إن تُركت فارغة.' },
    { type: 'checkbox', name: 'explicit', label: 'محتوى صريح (Explicit)' },
    { type: 'text', name: 'youtube_video_id', label: 'معرّف فيديو يوتيوب', dir: 'ltr', hint: 'الجزء بعد v= في رابط الفيديو (11 خانة).' },
    { type: 'text', name: 'spotify_episode_id', label: 'معرّف الحلقة في سبوتيفاي', dir: 'ltr', hint: 'من رابط الحلقة: open.spotify.com/episode/المعرّف' },
    { type: 'url', name: 'apple_episode_url', label: 'رابط الحلقة في آبل بودكاست', wide: true },
    { type: 'section', title: 'الفصول والنص المفرغ' },
    { type: 'textarea', name: 'chapters_text', label: 'الفصول', rows: 6, mono: true, dir: 'rtl', hint: 'سطر لكل فصل: 00:00 المقدمة | Intro (الجزء بعد | اختياري للإنجليزية)' },
    {
      type: 'textarea',
      name: 'transcript_text',
      label: 'النص المفرغ',
      rows: 10,
      hint: 'الصق ملف WebVTT أو SRT، أو نصًا عاديًا يبدأ كل مقطع فيه بتوقيت: [00:01:23] سارة: النص…',
    },
    { type: 'multiselect', name: 'guest_ids', label: 'ضيوف الحلقة', options: guests },
    ...publishFields(canPublish),
  ];
}

export function articleFields(canPublish: boolean, categories: { value: string; label: string }[], episodes: { value: string; label: string }[]): FieldConfig[] {
  return [
    { type: 'section', title: 'الأساسيات' },
    { type: 'text', name: 'title', label: 'العنوان', wide: true },
    { type: 'text', name: 'title_en', label: 'العنوان بالإنجليزية (اختياري)', dir: 'ltr', wide: true },
    { type: 'text', name: 'slug', label: 'الرابط المختصر (slug)', dir: 'ltr' },
    {
      type: 'select',
      name: 'kind',
      label: 'النوع',
      options: [
        { value: 'story', label: 'قصة' },
        { value: 'article', label: 'مقال' },
        { value: 'essay', label: 'تأمل' },
        { value: 'interview', label: 'حوار' },
      ],
    },
    { type: 'select', name: 'category_id', label: 'التصنيف', options: [{ value: '', label: '— بدون —' }, ...categories] },
    { type: 'text', name: 'author_name', label: 'اسم الكاتب كما يظهر', hint: 'يُملأ باسمك إن تُرك فارغًا.' },
    { type: 'textarea', name: 'dek', label: 'السطر التمهيدي', rows: 2 },
    { type: 'textarea', name: 'dek_en', label: 'السطر التمهيدي بالإنجليزية', rows: 2, dir: 'ltr' },
    { type: 'textarea', name: 'body', label: 'النص', rows: 18, hint: 'فقرات تفصلها سطور فارغة. يدعم: ## عنوان، > اقتباس، - قائمة، **عريض**، [رابط](https://…)' },
    { type: 'textarea', name: 'body_en', label: 'النص بالإنجليزية (اختياري)', rows: 10, dir: 'ltr' },
    { type: 'media', name: 'cover_image_id', label: 'صورة الغلاف', kind: 'image' },
    { type: 'select', name: 'related_episode_id', label: 'حلقة مرتبطة', options: [{ value: '', label: '— بدون —' }, ...episodes] },
    { type: 'checkbox', name: 'is_featured', label: 'مميز' },
    ...publishFields(canPublish),
  ];
}

export function guestFields(canPublish: boolean): FieldConfig[] {
  return [
    { type: 'section', title: 'بيانات الضيف', description: 'أضف الضيوف الحقيقيين فقط وبموافقتهم على نشر بياناتهم.' },
    { type: 'text', name: 'name', label: 'الاسم' },
    { type: 'text', name: 'name_en', label: 'الاسم بالإنجليزية', dir: 'ltr' },
    { type: 'text', name: 'slug', label: 'الرابط المختصر (slug)', dir: 'ltr' },
    { type: 'text', name: 'headline', label: 'التعريف المختصر', hint: 'مثل: كاتبة وباحثة في التاريخ الشفهي' },
    { type: 'text', name: 'headline_en', label: 'التعريف بالإنجليزية', dir: 'ltr', wide: true },
    { type: 'textarea', name: 'bio', label: 'نبذة' },
    { type: 'textarea', name: 'bio_en', label: 'النبذة بالإنجليزية', dir: 'ltr' },
    { type: 'media', name: 'photo_id', label: 'الصورة', kind: 'image' },
    { type: 'section', title: 'روابط' },
    { type: 'url', name: 'website_url', label: 'الموقع الشخصي' },
    { type: 'text', name: 'x_handle', label: 'حساب X', dir: 'ltr', placeholder: 'username' },
    { type: 'text', name: 'instagram_handle', label: 'حساب إنستغرام', dir: 'ltr', placeholder: 'username' },
    { type: 'url', name: 'linkedin_url', label: 'لينكدإن' },
    ...publishFields(canPublish),
  ];
}

export function clipFields(canPublish: boolean, episodes: { value: string; label: string }[]): FieldConfig[] {
  return [
    { type: 'section', title: 'المقطع' },
    { type: 'text', name: 'title', label: 'العنوان', wide: true },
    { type: 'text', name: 'title_en', label: 'العنوان بالإنجليزية', dir: 'ltr' },
    { type: 'text', name: 'slug', label: 'الرابط المختصر (slug)', dir: 'ltr' },
    { type: 'textarea', name: 'description', label: 'الوصف', rows: 3 },
    { type: 'select', name: 'episode_id', label: 'من حلقة', options: [{ value: '', label: '— بدون —' }, ...episodes] },
    {
      type: 'select',
      name: 'orientation',
      label: 'الاتجاه',
      options: [
        { value: 'vertical', label: 'عمودي 9:16' },
        { value: 'horizontal', label: 'أفقي 16:9' },
      ],
    },
    { type: 'section', title: 'المصدر', description: 'اختر واحدًا على الأقل: ملف مرفوع، أو فيديو يوتيوب، أو رابط خارجي.' },
    { type: 'media', name: 'video_asset_id', label: 'ملف الفيديو', kind: 'video' },
    { type: 'media', name: 'thumbnail_id', label: 'الصورة المصغرة', kind: 'image' },
    { type: 'text', name: 'youtube_video_id', label: 'معرّف يوتيوب', dir: 'ltr' },
    { type: 'url', name: 'external_url', label: 'رابط تيك توك أو إنستغرام أو X' },
    { type: 'number', name: 'duration_seconds', label: 'المدة بالثواني' },
    ...publishFields(canPublish),
  ];
}

/** DB row → form defaults: nulls become empty strings and timestamps become Riyadh datetime-local values. */
export function toFormValues(row: Record<string, unknown> | null, defaults: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...defaults };
  if (!row) return out;
  for (const key of Object.keys(defaults)) {
    const value = row[key];
    if (value === undefined) continue;
    if (key === 'published_at') {
      out[key] = value ? riyadhLocal(String(value)) : '';
    } else if (typeof defaults[key] === 'boolean') {
      out[key] = Boolean(value);
    } else if (Array.isArray(defaults[key])) {
      out[key] = Array.isArray(value) ? value : [];
    } else {
      out[key] = value === null ? '' : value;
    }
  }
  if (row.id) out.id = row.id;
  return out;
}

function riyadhLocal(iso: string): string {
  const date = new Date(new Date(iso).getTime() + 3 * 3600_000);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 16);
}
