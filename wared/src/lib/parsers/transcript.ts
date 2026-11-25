import { parseTimestamp } from '@/lib/format';
import type { TranscriptSegment } from '@/lib/types';

export type TranscriptFormat = 'plain' | 'vtt' | 'srt';

const CUE_TIME = /(\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{1,3}/g;

function cueSeconds(stamp: string): number {
  const [clock, fraction = '0'] = stamp.replace(',', '.').split('.');
  const whole = parseTimestamp(clock) ?? 0;
  return whole + Number(`0.${fraction}`);
}

function splitSpeaker(text: string): { speaker?: string; text: string } {
  // WebVTT voice tags: <v Speaker>text
  const voice = /^<v(?:\.[^\s>]+)?\s+([^>]+)>(.*)$/s.exec(text);
  if (voice?.[1] && voice[2] !== undefined) return { speaker: voice[1].trim(), text: voice[2].replace(/<\/v>/g, '').trim() };
  const colon = /^([^:：]{1,40})[:：]\s+(.+)$/s.exec(text);
  if (colon?.[1] && colon[2] && !/\d{1,2}:\d{2}/.test(colon[1])) return { speaker: colon[1].trim(), text: colon[2].trim() };
  return { text: text.trim() };
}

function stripTags(text: string): string {
  return text.replace(/<(?!v[\s.])[^>]+>/g, '');
}

/** Parses WebVTT or SRT cues. */
export function parseCues(input: string): TranscriptSegment[] {
  const blocks = input.replace(/\r/g, '').split(/\n{2,}/);
  const segments: TranscriptSegment[] = [];
  for (const block of blocks) {
    const lines = block.split('\n').filter((l) => l.trim() !== '');
    const timeLineIndex = lines.findIndex((l) => l.includes('-->'));
    if (timeLineIndex === -1) continue;
    const stamps = lines[timeLineIndex]?.match(CUE_TIME);
    if (!stamps || stamps.length < 2) continue;
    const text = stripTags(lines.slice(timeLineIndex + 1).join(' ')).trim();
    if (!text) continue;
    const { speaker, text: body } = splitSpeaker(text);
    if (!body) continue;
    segments.push({ start: cueSeconds(stamps[0]!), end: cueSeconds(stamps[1]!), ...(speaker ? { speaker } : {}), text: body });
  }
  return mergeAdjacent(segments);
}

/**
 * Parses plain transcripts where each paragraph starts with a timestamp:
 *   [00:01:23] سارة: النص...
 *   00:02:10 النص...
 * Lines without a timestamp continue the previous segment.
 */
export function parsePlain(input: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  for (const raw of input.replace(/\r/g, '').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const match = /^\[?(\d{1,2}(?::\d{1,2}){1,2})\]?\s*[-–—]?\s*(.*)$/.exec(line);
    const seconds = match ? parseTimestamp(match[1]) : null;
    if (match && seconds !== null) {
      const { speaker, text } = splitSpeaker(match[2] ?? '');
      segments.push({ start: seconds, ...(speaker ? { speaker } : {}), text });
    } else if (segments.length > 0) {
      const last = segments[segments.length - 1]!;
      last.text = `${last.text} ${line}`.trim();
    } else {
      segments.push({ start: 0, text: line });
    }
  }
  const filtered = segments.filter((s) => s.text);
  for (let i = 0; i < filtered.length - 1; i++) filtered[i]!.end = filtered[i + 1]!.start;
  return filtered;
}

/** Joins consecutive cues from the same speaker into readable paragraphs (cue files are often line-by-line). */
function mergeAdjacent(segments: TranscriptSegment[], maxChars = 420): TranscriptSegment[] {
  const merged: TranscriptSegment[] = [];
  for (const seg of segments) {
    const last = merged[merged.length - 1];
    if (last && last.speaker === seg.speaker && last.text.length + seg.text.length < maxChars && !/[.!?؟]$/.test(last.text)) {
      last.text = `${last.text} ${seg.text}`;
      last.end = seg.end;
    } else {
      merged.push({ ...seg });
    }
  }
  return merged;
}

export function detectFormat(input: string): TranscriptFormat {
  const head = input.trimStart().slice(0, 200);
  if (head.startsWith('WEBVTT')) return 'vtt';
  if (/^\d+\s*\n\d{1,2}:\d{2}:\d{2},\d{3}\s*-->/.test(head)) return 'srt';
  return 'plain';
}

export function parseTranscript(input: string, format: TranscriptFormat = detectFormat(input)): TranscriptSegment[] {
  const segments = format === 'plain' ? parsePlain(input) : parseCues(input);
  return segments.map((s) => ({ ...s, text: s.text.slice(0, 5000) })).slice(0, 20000);
}

export function segmentsToPlainText(segments: TranscriptSegment[]): string {
  return segments.map((s) => (s.speaker ? `${s.speaker}: ${s.text}` : s.text)).join('\n');
}

/** Index of the segment playing at `time`. */
export function segmentIndexAt(segments: TranscriptSegment[], time: number): number {
  let lo = 0;
  let hi = segments.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if ((segments[mid]?.start ?? Infinity) <= time) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}
