'use client';

import Image from 'next/image';
import { useState } from 'react';
import { useI18n } from '@/components/I18nProvider';
import { PlayIcon } from '@/components/ui/icons';
import { sendEvent } from '@/lib/client/analytics';
import { formatClock } from '@/lib/format';
import { pick } from '@/lib/i18n/config';
import type { Clip } from '@/lib/types';
import { Logo } from './Logo';

export function ClipCard({ clip }: { clip: Clip }) {
  const { dict, locale } = useI18n();
  const [playing, setPlaying] = useState(false);
  const title = pick(locale, clip.title, clip.titleEn);
  const aspect = clip.orientation === 'vertical' ? 'aspect-[9/16]' : 'aspect-video';
  const poster = clip.thumbnail?.url ?? (clip.youtubeVideoId ? `https://i.ytimg.com/vi/${clip.youtubeVideoId}/hqdefault.jpg` : null);

  const start = () => {
    sendEvent({ type: 'play_start', clipId: clip.id, locale });
    if (!clip.videoUrl && !clip.youtubeVideoId && clip.externalUrl) {
      window.open(clip.externalUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    setPlaying(true);
  };

  return (
    <figure className="group">
      <div className={`relative overflow-hidden rounded-[20px] bg-ink ${aspect}`}>
        {playing && clip.videoUrl ? (
          <video src={clip.videoUrl} poster={poster ?? undefined} controls autoPlay playsInline className="absolute inset-0 size-full object-cover" aria-label={title} />
        ) : playing && clip.youtubeVideoId ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${clip.youtubeVideoId}?autoplay=1&rel=0`}
            title={title}
            className="absolute inset-0 size-full"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <button type="button" onClick={start} className="absolute inset-0 size-full text-ivory" aria-label={`${dict.common.watch}: ${title}`}>
            {poster ? (
              poster.startsWith('https://i.ytimg.com') ? (
                // eslint-disable-next-line @next/next/no-img-element -- remote YouTube thumbnail
                <img src={poster} alt="" loading="lazy" className="absolute inset-0 size-full object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
              ) : (
                <Image src={poster} alt="" fill sizes="(min-width: 1024px) 20vw, 60vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
              )
            ) : (
              <span className="absolute inset-0 grid place-items-center">
                <Logo className="w-1/3 opacity-80" title="" />
              </span>
            )}
            <span className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-gradient-to-t from-ink/80 to-transparent p-4 pt-16">
              <span className="grid size-11 place-items-center rounded-full bg-ivory text-ink">
                <PlayIcon size={18} />
              </span>
              {clip.durationSeconds ? (
                <span className="text-xs tabular-nums" dir="ltr">
                  {formatClock(clip.durationSeconds)}
                </span>
              ) : null}
            </span>
          </button>
        )}
      </div>
      <figcaption className="mt-3">
        <p className="font-medium leading-snug">{title}</p>
        {clip.episode && (
          <p className="mt-1 text-sm text-muted">
            {dict.clips.fromEpisode.replace('{title}', pick(locale, clip.episode.title, clip.episode.titleEn))}
          </p>
        )}
      </figcaption>
    </figure>
  );
}
