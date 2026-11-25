import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ActionButton } from '@/components/admin/ActionButton';
import { EntityForm } from '@/components/admin/EntityForm';
import { AdminHeader, Notice } from '@/components/admin/ui';
import { deleteContent, saveEpisode } from '@/lib/admin/actions/content';
import { can, requireStaff } from '@/lib/admin/auth';
import { episodeFields, toFormValues } from '@/lib/admin/forms';
import { getRow, guestOptions, listTable, mediaOptions, programOptions } from '@/lib/admin/queries';
import { chaptersToText } from '@/lib/parsers/chapters';
import { formatClock } from '@/lib/format';
import { parseSegments } from '@/lib/data/mappers';

export const metadata = { title: 'تحرير حلقة' };

const DEFAULTS = {
  podcast_id: '',
  slug: '',
  number: '',
  season: '',
  episode_type: 'full',
  title: '',
  title_en: '',
  summary: '',
  summary_en: '',
  show_notes: '',
  show_notes_en: '',
  cover_image_id: '',
  audio_asset_id: '',
  audio_url: '',
  duration_seconds: '',
  youtube_video_id: '',
  spotify_episode_id: '',
  apple_episode_url: '',
  is_featured: false,
  explicit: false,
  status: 'draft',
  published_at: '',
  chapters_text: '',
  transcript_text: '',
  guest_ids: [] as string[],
};

export default async function EpisodeEditor({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff('content.edit_any');
  const { id } = await params;
  const isNew = id === 'new';
  const row = isNew ? null : await getRow('episodes', id);
  if (!isNew && !row) notFound();

  const [programs, guests, media, chapters, transcripts, links] = await Promise.all([
    programOptions(),
    guestOptions(),
    mediaOptions(),
    isNew ? [] : listTable('episode_chapters', 'start_seconds, title, title_en', { filter: ['episode_id', id], order: 'start_seconds' }),
    isNew ? [] : listTable('transcripts', 'locale, segments, source_format', { filter: ['episode_id', id], order: 'locale' }),
    isNew ? [] : listTable('episode_guests', 'guest_id', { filter: ['episode_id', id], order: 'position' }),
  ]);

  const values = toFormValues(row, DEFAULTS);
  values.chapters_text = chaptersToText(
    [...chapters]
      .sort((a, b) => Number(a.start_seconds) - Number(b.start_seconds))
      .map((c) => ({ startSeconds: Number(c.start_seconds), title: String(c.title), titleEn: (c.title_en as string) ?? null })),
  );
  const transcript = transcripts.find((t) => t.locale === 'ar');
  values.transcript_text = transcript
    ? parseSegments(transcript.segments)
        .map((s) => `[${formatClock(s.start)}] ${s.speaker ? `${s.speaker}: ` : ''}${s.text}`)
        .join('\n')
    : '';
  values.guest_ids = links.map((l) => String(l.guest_id));
  if (isNew && programs[0]) values.podcast_id = programs[0].value;

  return (
    <>
      <AdminHeader
        title={isNew ? 'حلقة جديدة' : String(row?.title)}
        back={{ href: '/admin/episodes', label: 'الحلقات' }}
        actions={
          !isNew && (
            <>
              <Link href={`/admin/preview/episodes/${id}`} className="btn btn-ghost min-h-10 px-4 text-sm" target="_blank">
                معاينة
              </Link>
              {can(staff, 'content.delete') && (
                <ActionButton action={deleteContent.bind(null, 'episodes', id)} label="حذف" tone="danger" confirm="حذف الحلقة نهائيًا مع فصولها ونصها؟" />
              )}
            </>
          )
        }
      />
      {programs.length === 0 ? (
        <Notice tone="warn">
          أنشئ برنامجًا أولًا، فكل حلقة تنتمي لبرنامج. <Link href="/admin/programs/new" className="underline">إنشاء برنامج</Link>
        </Notice>
      ) : (
        <EntityForm schema="episode" action={saveEpisode} fields={episodeFields(can(staff, 'content.publish'), programs, guests)} defaultValues={values} media={media} />
      )}
    </>
  );
}
