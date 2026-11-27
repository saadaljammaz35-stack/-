import { describe, expect, it } from 'vitest';
import { demoEpisodes } from '@/content/demo';
import { buildPodcastFeed, escapeXml, transcriptToVtt } from '@/lib/rss';
import type { SiteSettings } from '@/lib/types';

const settings: SiteSettings = {
  general: { site_name: 'وارد', site_name_en: 'Wared', tagline: '', tagline_en: '', contact_email: 'hello@example.com', announcement: null },
  platforms: { spotify: null, apple_podcasts: null, youtube: null, anghami: null },
  social: { x: null, instagram: null, tiktok: null, youtube: null, linkedin: null },
  brand: { display_font: 'plex' },
};

describe('podcast feed', () => {
  const [first, second] = demoEpisodes;
  const episodes = [
    { ...first!, title: 'حلقة <خاصة> & "مميزة"', audioUrl: 'https://cdn.example/a.mp3', audioBytes: 1234 },
    { ...second!, audioUrl: null },
  ];
  const xml = buildPodcastFeed({
    siteUrl: 'https://wared.example',
    feedUrl: 'https://wared.example/rss.xml',
    program: null,
    settings,
    episodes,
    defaultArtworkUrl: 'https://wared.example/brand/podcast-artwork.jpg',
    now: new Date('2026-11-25T00:00:00Z'),
  });

  it('is well-formed RSS with the podcast namespaces', () => {
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"');
    expect(xml).toContain('<itunes:owner><itunes:name>وارد</itunes:name><itunes:email>hello@example.com</itunes:email></itunes:owner>');
    expect(xml).toContain('<itunes:category text="Society &amp; Culture">');
    const parsed = new DOMParserLike(xml);
    expect(parsed.ok).toBe(true);
  });

  it('escapes titles and only lists episodes that have audio', () => {
    expect(xml).toContain('<title>حلقة &lt;خاصة&gt; &amp; &quot;مميزة&quot;</title>');
    expect(xml.match(/<item>/g)).toHaveLength(1);
    expect(xml).toContain('<enclosure url="https://cdn.example/a.mp3" length="1234" type="audio/mpeg"/>');
    expect(xml).toContain('podcast:chapters');
  });

  it('exports transcripts as WebVTT', () => {
    const vtt = transcriptToVtt([{ start: 0, end: 2.5, speaker: 'سارة', text: 'أهلًا' }, { start: 3, text: 'ثانيًا' }]);
    expect(vtt).toBe('WEBVTT\n\n00:00:00.000 --> 00:00:02.500\n<v سارة>أهلًا\n\n00:00:03.000 --> 00:00:08.000\nثانيًا\n');
  });

  it('strips characters that are illegal in XML', () => {
    expect(escapeXml('a\u0000b\u0008c')).toBe('abc');
  });
});

/** Minimal well-formedness check: balanced tags outside CDATA. */
class DOMParserLike {
  ok: boolean;
  constructor(xml: string) {
    const body = xml.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '').replace(/<\?xml[^>]*\?>/, '');
    const stack: string[] = [];
    let ok = true;
    for (const match of body.matchAll(/<(\/?)([a-zA-Z][\w:.-]*)[^>]*?(\/?)>/g)) {
      const [, closing, name, selfClosing] = match;
      if (selfClosing) continue;
      if (closing) {
        if (stack.pop() !== name) ok = false;
      } else stack.push(name!);
    }
    this.ok = ok && stack.length === 0;
  }
}
