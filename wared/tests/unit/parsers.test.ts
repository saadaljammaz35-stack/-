import { describe, expect, it } from 'vitest';
import { chapterIndexAt, chaptersToText, parseChapters } from '@/lib/parsers/chapters';
import { detectFormat, parseTranscript, segmentIndexAt, segmentsToPlainText } from '@/lib/parsers/transcript';

describe('chapters', () => {
  it('parses lines with optional English titles and reports bad lines', () => {
    const { items, errors } = parseChapters('00:00 المقدمة | Intro\n12:30 - البداية\nwrong line\n1:02:03 الخاتمة');
    expect(items).toEqual([
      { startSeconds: 0, title: 'المقدمة', titleEn: 'Intro' },
      { startSeconds: 750, title: 'البداية', titleEn: null },
      { startSeconds: 3723, title: 'الخاتمة', titleEn: null },
    ]);
    expect(errors).toEqual([{ line: 3, text: 'wrong line' }]);
  });
  it('round-trips through text and finds the current chapter', () => {
    const { items } = parseChapters('00:00 أ\n05:00 ب | B');
    expect(parseChapters(chaptersToText(items)).items).toEqual(items);
    expect(chapterIndexAt(items, 0)).toBe(0);
    expect(chapterIndexAt(items, 299)).toBe(0);
    expect(chapterIndexAt(items, 300)).toBe(1);
    expect(chapterIndexAt([], 10)).toBe(-1);
  });
});

describe('transcripts', () => {
  it('parses plain timestamped paragraphs with speakers and continuation lines', () => {
    const text = '[00:00] سارة: أهلًا بكم\nفي حلقة جديدة\n[00:12] خالد: شكرًا';
    const segments = parseTranscript(text);
    expect(detectFormat(text)).toBe('plain');
    expect(segments).toEqual([
      { start: 0, speaker: 'سارة', text: 'أهلًا بكم في حلقة جديدة', end: 12 },
      { start: 12, speaker: 'خالد', text: 'شكرًا' },
    ]);
    expect(segmentsToPlainText(segments)).toBe('سارة: أهلًا بكم في حلقة جديدة\nخالد: شكرًا');
  });

  it('parses WebVTT with voice tags and merges unfinished sentences', () => {
    const vtt = 'WEBVTT\n\n00:00:01.000 --> 00:00:03.500\n<v Sara>Hello there\n\n00:00:03.500 --> 00:00:05.000\n<v Sara>and welcome.\n\n00:00:06.000 --> 00:00:08.000\n<v Khaled>Thanks.';
    expect(detectFormat(vtt)).toBe('vtt');
    expect(parseTranscript(vtt)).toEqual([
      { start: 1, end: 5, speaker: 'Sara', text: 'Hello there and welcome.' },
      { start: 6, end: 8, speaker: 'Khaled', text: 'Thanks.' },
    ]);
  });

  it('parses SRT and strips formatting tags', () => {
    const srt = '1\n00:00:01,000 --> 00:00:02,000\n<i>مرحبا.</i>\n\n2\n00:01:00,500 --> 00:01:02,000\nثانيًا.';
    expect(detectFormat(srt)).toBe('srt');
    expect(parseTranscript(srt)).toEqual([
      { start: 1, end: 2, text: 'مرحبا.' },
      { start: 60.5, end: 62, text: 'ثانيًا.' },
    ]);
  });

  it('finds the active segment with binary search', () => {
    const segments = [{ start: 0, text: 'a' }, { start: 10, text: 'b' }, { start: 20, text: 'c' }];
    expect(segmentIndexAt(segments, -1)).toBe(-1);
    expect(segmentIndexAt(segments, 0)).toBe(0);
    expect(segmentIndexAt(segments, 15)).toBe(1);
    expect(segmentIndexAt(segments, 99)).toBe(2);
  });
});
