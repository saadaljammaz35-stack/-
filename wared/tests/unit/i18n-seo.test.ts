import { describe, expect, it } from 'vitest';
import { ar } from '@/lib/i18n/dictionaries/ar';
import { en } from '@/lib/i18n/dictionaries/en';
import { isFallback, localePath, pick, t } from '@/lib/i18n';
import { jsonLdString } from '@/lib/seo';
import { mapEpisode, parseSegments } from '@/lib/data/mappers';

function keys(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return [prefix];
  return Object.entries(value).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
}

describe('dictionaries', () => {
  it('have the same keys in Arabic and English', () => {
    expect(keys(en).sort()).toEqual(keys(ar).sort());
  });
  it('interpolate and pick translations', () => {
    expect(t('الحلقة {n}', { n: 4 })).toBe('الحلقة 4');
    expect(pick('en', 'عربي', 'English')).toBe('English');
    expect(pick('en', 'عربي', null)).toBe('عربي');
    expect(isFallback('en', null)).toBe(true);
    expect(localePath('ar', '/')).toBe('/ar');
    expect(localePath('en', '/episodes')).toBe('/en/episodes');
  });
});

describe('JSON-LD', () => {
  it('cannot break out of its script tag', () => {
    expect(jsonLdString({ name: '</script><script>alert(1)</script>' })).not.toContain('</script>');
  });
});

describe('mappers', () => {
  it('maps nested PostgREST rows into an episode', () => {
    const episode = mapEpisode({
      id: 'e1',
      slug: 'ep',
      title: 'ح',
      episode_type: 'full',
      duration_seconds: null,
      audio_url: 'https://cdn.example/a.mp3',
      program: [{ id: 'p', slug: 'show', kind: 'podcast', title: 'برنامج' }],
      chapters: [
        { start_seconds: 60, title: 'ب', title_en: null },
        { start_seconds: 0, title: 'أ', title_en: 'A' },
      ],
      transcripts: [{ locale: 'ar', segments: [{ start: 3, text: 'ثانيًا' }, { start: 0, text: 'أولًا' }, { start: 'x', text: 'bad' }] }],
      episode_guests: [{ role: 'guest', position: 0, guest: { id: 'g', slug: 'g', name: 'ضيف' } }],
    });
    expect(episode.program.slug).toBe('show');
    expect(episode.chapters.map((c) => c.startSeconds)).toEqual([0, 60]);
    expect(episode.transcript?.segments.map((s) => s.text)).toEqual(['أولًا', 'ثانيًا']);
    expect(episode.guests[0]?.name).toBe('ضيف');
    expect(episode.audioUrl).toBe('https://cdn.example/a.mp3');
  });
  it('ignores malformed transcript segments', () => {
    expect(parseSegments('nope')).toEqual([]);
    expect(parseSegments([{ start: 1, text: '' }, null, { start: 2, text: 'ok', speaker: 5 }])).toEqual([{ start: 2, text: 'ok' }]);
  });
});
