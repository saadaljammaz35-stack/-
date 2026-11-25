/**
 * Pure timeline math for the montage: which parts of the source are kept, how a source
 * time maps onto the edited output, and the caption/chapter files built from that.
 * Everything here is deterministic and unit-tested; nothing touches media.
 */

export type Span = [number, number];

export interface Cue {
  start: number;
  end: number;
  text: string;
}

export interface Word {
  start: number;
  end: number;
  word: string;
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;

/** Sort, clamp to [0, duration] and merge overlapping/touching spans. */
export function mergeSpans(spans: Span[], duration = Infinity, joinGap = 0.04): Span[] {
  const s = spans
    .map(([a, b]) => [Math.max(0, a), Math.min(duration, b)] as Span)
    .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b) && b > a)
    .sort((x, y) => x[0] - y[0]);
  const out: Span[] = [];
  for (const [a, b] of s) {
    const last = out[out.length - 1];
    if (last && a <= last[1] + joinGap) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out.map(([a, b]) => [r3(a), r3(b)]);
}

/**
 * The complement of the removed spans. Kept fragments shorter than `minKeep` are dropped
 * (a 0.1 s sliver between two cuts sounds like a glitch, not speech).
 */
export function keepSegments(duration: number, removed: Span[], minKeep = 0.25): Span[] {
  const cuts = mergeSpans(removed, duration);
  const keeps: Span[] = [];
  let t = 0;
  for (const [a, b] of cuts) {
    if (a - t >= minKeep) keeps.push([r3(t), r3(a)]);
    t = Math.max(t, b);
  }
  if (duration - t >= minKeep) keeps.push([r3(t), r3(duration)]);
  return keeps;
}

export const totalLength = (spans: Span[]) => r3(spans.reduce((n, [a, b]) => n + (b - a), 0));

/** Intersect keep-segments with a window [start, end] (used for shorts). */
export function clipSegments(keeps: Span[], start: number, end: number): Span[] {
  const out: Span[] = [];
  for (const [a, b] of keeps) {
    const x = Math.max(a, start);
    const y = Math.min(b, end);
    if (y - x > 0.05) out.push([r3(x), r3(y)]);
  }
  return out;
}

/**
 * Map a source time onto the output timeline. A time inside a cut lands on the cut point
 * (the end of the previous kept segment is the start of the next one in the output).
 */
export function mapTime(t: number, keeps: Span[]): number {
  let acc = 0;
  for (const [a, b] of keeps) {
    if (t < a) return r3(acc);
    if (t <= b) return r3(acc + (t - a));
    acc += b - a;
  }
  return r3(acc);
}

/** Move cues onto the output timeline; cues that fall entirely inside cuts disappear. */
export function remapCues(cues: Cue[], keeps: Span[]): Cue[] {
  const out: Cue[] = [];
  for (const c of cues) {
    const inside = clipSegments(keeps, c.start, c.end);
    if (!inside.length) continue;
    const start = mapTime(inside[0]![0], keeps);
    const end = mapTime(inside[inside.length - 1]![1], keeps);
    if (end - start >= 0.08) out.push({ start, end, text: c.text });
  }
  return out;
}

export function fmtClock(t: number, ms = false): string {
  const total = Math.max(0, t);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  const base = h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
  return ms ? `${base}.${String(Math.floor((total % 1) * 10))}` : base;
}

function srtTime(t: number): string {
  const total = Math.max(0, t);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  const ms = Math.round((total % 1) * 1000) % 1000;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

export function toSrt(cues: Cue[]): string {
  return cues.map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${c.text.trim()}\n`).join('\n');
}

// ─────────────────────────── transcripts from files ───────────────────────────

function parseClock(s: string): number {
  const p = s.trim().replace(',', '.').split(':');
  if (p.length === 3) return Number(p[0]) * 3600 + Number(p[1]) * 60 + Number(p[2]);
  if (p.length === 2) return Number(p[0]) * 60 + Number(p[1]);
  return Number(p[0]);
}

/** SRT, WebVTT, or whisper-style JSON ({segments|cues:[{start,end,text}]}) → cues. */
export function parseTranscript(raw: string, name = ''): Cue[] {
  const text = raw.replace(/^﻿/, '');
  if (name.endsWith('.json') || /^\s*[[{]/.test(text)) {
    const d = JSON.parse(text) as unknown;
    const list = (Array.isArray(d) ? d : ((d as { segments?: unknown[]; cues?: unknown[] }).segments ?? (d as { cues?: unknown[] }).cues ?? [])) as { start: number; end: number; text?: string }[];
    return list
      .map((s) => ({ start: Number(s.start), end: Number(s.end), text: String(s.text ?? '').trim() }))
      .filter((c) => Number.isFinite(c.start) && c.end > c.start && c.text);
  }
  const cues: Cue[] = [];
  let cur: { start: number; end: number; lines: string[] } | null = null;
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*((?:\d+:)?\d{1,2}:\d{2}[.,]\d{1,3})\s*-->\s*((?:\d+:)?\d{1,2}:\d{2}[.,]\d{1,3})/.exec(line);
    if (m) {
      cur = { start: parseClock(m[1]!), end: parseClock(m[2]!), lines: [] };
      cues.push(cur as unknown as Cue);
      continue;
    }
    const t = line.trim();
    if (!cur || !t || /^\d+$/.test(t) || t === 'WEBVTT') continue;
    cur.lines.push(t.replace(/<[^>]+>/g, ''));
  }
  return (cues as unknown as { start: number; end: number; lines: string[] }[])
    .map((c) => ({ start: r3(c.start), end: r3(c.end), text: c.lines.join(' ').trim() }))
    .filter((c) => c.end > c.start && c.text);
}

// ─────────────────────────── chapters ───────────────────────────

export interface Chapter {
  start: number;
  title: string;
}

/**
 * Chapters on the OUTPUT timeline, validated against YouTube's rules so they render:
 * the first starts at 0:00, there are at least three, and each lasts ten seconds or more.
 */
export function finalizeChapters(chapters: Chapter[], keeps: Span[]): { chapters: Chapter[]; valid: boolean; reason?: string } {
  const outLen = totalLength(keeps);
  const mapped = chapters
    .map((c) => ({ start: mapTime(c.start, keeps), title: c.title.trim().slice(0, 100) }))
    .filter((c) => c.title)
    .sort((a, b) => a.start - b.start);
  if (!mapped.length) return { chapters: [], valid: false, reason: 'no_chapters' };
  mapped[0]!.start = 0;
  const out: Chapter[] = [];
  for (const c of mapped) {
    const prev = out[out.length - 1];
    if (prev && c.start - prev.start < 10) continue;
    if (outLen - c.start < 10 && out.length) continue;
    out.push(c);
  }
  if (out.length < 3) return { chapters: out, valid: false, reason: 'fewer_than_3' };
  return { chapters: out, valid: true };
}

export function chaptersText(chapters: Chapter[]): string {
  return chapters.map((c) => `${fmtClock(c.start)} ${c.title}`).join('\n');
}

// ─────────────────────────── burned-in captions (ASS) ───────────────────────────

const ASS_COLOR = (hex: string, alpha = '00') => {
  const h = hex.replace('#', '');
  return `&H${alpha}${h.slice(4, 6)}${h.slice(2, 4)}${h.slice(0, 2)}`.toUpperCase();
};

function assTime(t: number): string {
  const total = Math.max(0, t);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  const cs = Math.floor((total % 1) * 100);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

const assText = (s: string) => s.replace(/[{}\\]/g, '').replace(/\s+/g, ' ').trim();

/**
 * Split speech into short on-screen chunks (≤ maxWords, ≤ maxChars). Uses word timings when
 * the transcript has them, otherwise spreads a cue's time over its words by length.
 */
export function captionChunks(cues: Cue[], words: Word[] | undefined, start: number, end: number, maxWords = 4, maxChars = 26): Cue[] {
  const inWindow = (a: number, b: number) => b > start && a < end;
  let units: Word[];
  if (words?.length) {
    units = words.filter((w) => inWindow(w.start, w.end));
  } else {
    units = [];
    for (const c of cues.filter((c) => inWindow(c.start, c.end))) {
      const toks = c.text.split(/\s+/).filter(Boolean);
      const chars = toks.reduce((n, t) => n + t.length + 1, 0) || 1;
      let t = c.start;
      for (const tok of toks) {
        const d = ((tok.length + 1) / chars) * (c.end - c.start);
        units.push({ start: t, end: t + d, word: tok });
        t += d;
      }
    }
    units = units.filter((w) => inWindow(w.start, w.end));
  }
  const out: Cue[] = [];
  let cur: Cue | null = null;
  let count = 0;
  for (const w of units) {
    const gap = cur ? w.start - cur.end : 0;
    if (!cur || count >= maxWords || cur.text.length + w.word.length + 1 > maxChars || gap > 0.6) {
      cur = { start: w.start, end: w.end, text: w.word };
      out.push(cur);
      count = 1;
    } else {
      cur.end = w.end;
      cur.text = `${cur.text} ${w.word}`;
      count++;
    }
  }
  return out;
}

export interface ShortCaptionInput {
  cues: Cue[];
  words?: Word[];
  /** Kept parts of the short, in SOURCE time. */
  segments: Span[];
  hook?: string;
  font?: string;
}

/** An ASS subtitle file for a 1080×1920 short: WARD TYPE captions, right-to-left, hook on top. */
export function buildShortAss(input: ShortCaptionInput): string {
  const font = input.font ?? 'WARD Type Original';
  const segs = input.segments;
  const start = segs[0]?.[0] ?? 0;
  const end = segs[segs.length - 1]?.[1] ?? 0;
  const chunks = remapCues(captionChunks(input.cues, input.words, start, end), segs);
  const ivory = ASS_COLOR('#F2EFE8');
  const charcoal = ASS_COLOR('#171717');
  const sand = ASS_COLOR('#C3A77A');
  const lines = [
    '[Script Info]',
    'ScriptType: v4.00+',
    'PlayResX: 1080',
    'PlayResY: 1920',
    'WrapStyle: 0',
    'ScaledBorderAndShadow: yes',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    // Encoding -1: base direction from the text (right-to-left for Arabic) — with 1 the words come out reversed.
    `Style: Cap,${font},88,${ivory},${ivory},${charcoal},&H00000000,-1,0,0,0,100,100,0,0,1,7,0,2,70,70,560,-1`,
    `Style: Hook,${font},74,${charcoal},${charcoal},${sand},${sand},-1,0,0,0,100,100,0,0,3,24,0,8,90,90,300,-1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ];
  const hook = input.hook ? assText(input.hook) : '';
  if (hook) lines.push(`Dialogue: 1,${assTime(0)},${assTime(2.4)},Hook,,0,0,0,,${hook}`);
  for (const c of chunks) {
    const t = assText(c.text);
    if (t) lines.push(`Dialogue: 0,${assTime(c.start)},${assTime(c.end + 0.05)},Cap,,0,0,0,,${t}`);
  }
  return lines.join('\n') + '\n';
}
