import type { Episode, Program, SiteSettings } from '@/lib/types';

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    // Strip characters that are illegal in XML 1.0.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}

function cdata(value: string): string {
  return `<![CDATA[${value.replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;
}

function hms(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

function paragraphsToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeXml(p.trim()).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

export interface FeedOptions {
  siteUrl: string;
  feedUrl: string;
  program: Pick<Program, 'title' | 'titleEn' | 'slug' | 'description' | 'tagline' | 'hosts' | 'explicit' | 'itunesCategory' | 'language' | 'cover'> | null;
  settings: SiteSettings;
  episodes: Episode[];
  defaultArtworkUrl: string;
  now?: Date;
}

/** Podcast RSS 2.0 feed compatible with Apple Podcasts, Spotify and the Podcasting 2.0 namespace. */
export function buildPodcastFeed(options: FeedOptions): string {
  const { siteUrl, feedUrl, program, settings, episodes } = options;
  const title = program?.title ?? settings.general.site_name;
  const description =
    program?.description ?? program?.tagline ?? 'وارد منصة إعلامية سعودية مستقلة: بودكاست وقصص وحوارات وتجارب إنسانية.';
  const author = program?.hosts ?? settings.general.site_name;
  const artwork = program?.cover?.url ?? options.defaultArtworkUrl;
  const link = program ? `${siteUrl}/ar/programs/${program.slug}` : `${siteUrl}/ar/podcast`;
  const ownerEmail = settings.general.contact_email;
  const category = program?.itunesCategory ?? 'Society & Culture';
  const [mainCategory, subCategory] = category.split('|').map((c) => c.trim());

  const items = episodes
    .filter((e) => e.audioUrl && e.publishedAt)
    .map((e) => {
      const url = `${siteUrl}/ar/episodes/${e.slug}`;
      const notes = e.showNotes ?? e.summary ?? '';
      const audioUrl = e.audioUrl!.startsWith('http') ? e.audioUrl! : `${siteUrl}${e.audioUrl}`;
      return [
        '<item>',
        `<title>${escapeXml(e.title)}</title>`,
        `<link>${escapeXml(url)}</link>`,
        `<guid isPermaLink="false">wared-${escapeXml(e.id)}</guid>`,
        `<pubDate>${new Date(e.publishedAt!).toUTCString()}</pubDate>`,
        `<description>${cdata(paragraphsToHtml(notes))}</description>`,
        `<content:encoded>${cdata(paragraphsToHtml(notes))}</content:encoded>`,
        `<enclosure url="${escapeXml(audioUrl)}" length="${e.audioBytes ?? 0}" type="${escapeXml(e.audioMime ?? 'audio/mpeg')}"/>`,
        e.durationSeconds ? `<itunes:duration>${hms(e.durationSeconds)}</itunes:duration>` : '',
        e.number ? `<itunes:episode>${e.number}</itunes:episode>` : '',
        e.season ? `<itunes:season>${e.season}</itunes:season>` : '',
        `<itunes:episodeType>${e.episodeType}</itunes:episodeType>`,
        `<itunes:explicit>${e.explicit ? 'true' : 'false'}</itunes:explicit>`,
        e.summary ? `<itunes:summary>${escapeXml(e.summary)}</itunes:summary>` : '',
        e.cover ? `<itunes:image href="${escapeXml(e.cover.url.startsWith('http') ? e.cover.url : `${siteUrl}${e.cover.url}`)}"/>` : '',
        e.chapters.length > 0
          ? `<podcast:chapters url="${escapeXml(`${siteUrl}/api/episodes/${e.slug}/chapters`)}" type="application/json+chapters"/>`
          : '',
        e.transcript && e.transcript.segments.length > 0
          ? `<podcast:transcript url="${escapeXml(`${siteUrl}/api/episodes/${e.slug}/transcript`)}" type="text/vtt" language="${e.transcript.locale}"/>`
          : '',
        '</item>',
      ]
        .filter(Boolean)
        .join('\n');
    });

  const lastBuild = (options.now ?? new Date()).toUTCString();

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:podcast="https://podcastindex.org/namespace/1.0">
<channel>
<title>${escapeXml(title)}</title>
<link>${escapeXml(link)}</link>
<atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml"/>
<language>${program?.language ?? 'ar'}</language>
<description>${cdata(description)}</description>
<itunes:summary>${escapeXml(description)}</itunes:summary>
<itunes:author>${escapeXml(author)}</itunes:author>
<itunes:image href="${escapeXml(artwork.startsWith('http') ? artwork : `${siteUrl}${artwork}`)}"/>
<image><url>${escapeXml(artwork.startsWith('http') ? artwork : `${siteUrl}${artwork}`)}</url><title>${escapeXml(title)}</title><link>${escapeXml(link)}</link></image>
<itunes:category text="${escapeXml(mainCategory ?? 'Society & Culture')}">${subCategory ? `<itunes:category text="${escapeXml(subCategory)}"/>` : ''}</itunes:category>
<itunes:explicit>${program?.explicit ? 'true' : 'false'}</itunes:explicit>
<itunes:type>episodic</itunes:type>
${ownerEmail ? `<itunes:owner><itunes:name>${escapeXml(settings.general.site_name)}</itunes:name><itunes:email>${escapeXml(ownerEmail)}</itunes:email></itunes:owner>` : ''}
<copyright>${escapeXml(`© ${new Date().getFullYear()} ${settings.general.site_name}`)}</copyright>
<lastBuildDate>${lastBuild}</lastBuildDate>
<podcast:locked>yes</podcast:locked>
${items.join('\n')}
</channel>
</rss>`;
}

/** WebVTT export of a transcript (served for podcast apps that support Podcasting 2.0 transcripts). */
export function transcriptToVtt(segments: { start: number; end?: number; speaker?: string; text: string }[]): string {
  const stamp = (t: number) => {
    const ms = Math.round((t % 1) * 1000);
    return `${hms(t)}.${String(ms).padStart(3, '0')}`;
  };
  const cues = segments.map((s, i) => {
    const end = s.end ?? segments[i + 1]?.start ?? s.start + 5;
    const text = s.speaker ? `<v ${s.speaker}>${s.text}` : s.text;
    return `${stamp(s.start)} --> ${stamp(Math.max(end, s.start + 0.5))}\n${text}`;
  });
  return `WEBVTT\n\n${cues.join('\n\n')}\n`;
}
