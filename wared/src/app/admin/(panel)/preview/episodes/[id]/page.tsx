import { notFound } from 'next/navigation';
import { PreviewShell } from '@/components/admin/PreviewShell';
import { Chapters } from '@/components/player/Chapters';
import { EpisodePlayer } from '@/components/player/EpisodePlayer';
import { Transcript } from '@/components/player/Transcript';
import { Cover } from '@/components/site/blocks';
import { RichText } from '@/components/ui/RichText';
import { requireStaff } from '@/lib/admin/auth';
import { STATUS_LABELS } from '@/lib/admin/permissions';
import { EPISODE_COLUMNS, mapEpisode } from '@/lib/data/mappers';
import { getSessionClient } from '@/lib/supabase/server';
import { toTrack } from '@/lib/track';

export const metadata = { title: 'معاينة حلقة' };

export default async function EpisodePreview({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff('content.read_all');
  const { id } = await params;
  const db = await getSessionClient();
  const { data } = db && /^[0-9a-f-]{36}$/i.test(id) ? await db.from('episodes').select(`${EPISODE_COLUMNS}, status`).eq('id', id).maybeSingle() : { data: null };
  if (!data) notFound();
  const episode = mapEpisode(data as Record<string, unknown>);
  const track = toTrack(episode, 'ar');
  return (
    <PreviewShell status={STATUS_LABELS[(data as { status: keyof typeof STATUS_LABELS }).status]}>
      <article className="space-y-12">
        <header className="grid gap-10 md:grid-cols-[1.25fr_1fr]">
          <div className="flex flex-col justify-end">
            <p className="mb-4 text-sm text-accent">{episode.program.title}</p>
            <h1 className="display text-[clamp(2.25rem,5vw,4.5rem)]">{episode.title}</h1>
            {episode.summary && <p className="mt-5 text-lg leading-8 text-muted">{episode.summary}</p>}
          </div>
          <Cover media={episode.cover ?? episode.program.cover} alt="" sizes="40vw" className="aspect-square rounded-[28px]" />
        </header>
        <div className="grid gap-14 md:grid-cols-[1.25fr_1fr]">
          <div className="space-y-12">
            {track ? <EpisodePlayer track={track} /> : <p className="text-muted">لا يوجد ملف صوتي بعد.</p>}
            {episode.showNotes && <RichText text={episode.showNotes} />}
            {track && <Transcript track={track} segments={episode.transcript?.segments ?? []} lang="ar" />}
          </div>
          {track && <Chapters track={track} chapters={episode.chapters} />}
        </div>
      </article>
    </PreviewShell>
  );
}
