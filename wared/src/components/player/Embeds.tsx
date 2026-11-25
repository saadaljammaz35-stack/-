'use client';

import { useState } from 'react';
import { useI18n } from '@/components/I18nProvider';
import { PlayIcon } from '@/components/ui/icons';

/**
 * YouTube is loaded only after the visitor asks for it (privacy-enhanced youtube-nocookie domain), which keeps
 * third-party scripts and cookies off the page by default and protects Core Web Vitals.
 */
export function YouTubeEmbed({ videoId, title }: { videoId: string; title: string }) {
  const { dict } = useI18n();
  const [active, setActive] = useState(false);
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) return null;
  return (
    <div className="relative aspect-video overflow-hidden rounded-[20px] bg-ink">
      {active ? (
        <iframe
          className="absolute inset-0 size-full"
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      ) : (
        <button type="button" onClick={() => setActive(true)} className="group absolute inset-0 size-full text-ivory">
          {/* eslint-disable-next-line @next/next/no-img-element -- remote YouTube thumbnail, loaded lazily */}
          <img
            src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
            alt=""
            loading="lazy"
            className="absolute inset-0 size-full object-cover opacity-70 transition-opacity group-hover:opacity-85"
          />
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink/30">
            <span className="grid size-16 place-items-center rounded-full bg-ivory text-ink">
              <PlayIcon size={26} />
            </span>
            <span className="text-sm font-medium">{dict.player.loadVideo}</span>
            <span className="max-w-xs px-4 text-center text-xs text-ivory/80">{dict.player.videoConsent}</span>
          </span>
        </button>
      )}
    </div>
  );
}

export function SpotifyEmbed({ episodeId, title }: { episodeId: string; title: string }) {
  if (!/^[A-Za-z0-9]{22}$/.test(episodeId)) return null;
  return (
    <iframe
      title={`Spotify: ${title}`}
      src={`https://open.spotify.com/embed/episode/${episodeId}?utm_source=generator`}
      className="h-[152px] w-full rounded-xl border-0"
      loading="lazy"
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
    />
  );
}

export function AppleEmbed({ url, title }: { url: string; title: string }) {
  let src: string | null = null;
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'podcasts.apple.com') {
      parsed.hostname = 'embed.podcasts.apple.com';
      src = parsed.toString();
    }
  } catch {
    src = null;
  }
  if (!src) return null;
  return (
    <iframe
      title={`Apple Podcasts: ${title}`}
      src={src}
      className="h-[175px] w-full overflow-hidden rounded-xl border-0"
      loading="lazy"
      sandbox="allow-forms allow-popups allow-same-origin allow-scripts allow-storage-access-by-user-activation allow-top-navigation-by-user-activation"
      allow="autoplay *; encrypted-media *; clipboard-write"
    />
  );
}
