import { z } from 'zod';
import { normalizeArabic } from '@/lib/knowledge';
import { fmtClock, keepSegments, mergeSpans, totalLength, type Chapter, type Cue, type Span, type Word } from '@/lib/media/timeline';

/**
 * The edit plan for one episode. Deterministic cuts (dead air, hesitation-only phrases,
 * restarted sentences) come from measurements; the Production agent adds what needs
 * judgement (chapters, shorts, optional content cuts). The founder reviews all of it
 * before anything is rendered.
 */

export type CutKind = 'dead' | 'filler' | 'repeat' | 'content' | 'manual';
export type Framing = 'fit' | 'center' | 'left' | 'right';
export const FRAMINGS: Framing[] = ['fit', 'center', 'left', 'right'];

export interface PlanCut {
  id: string;
  kind: CutKind;
  start: number;
  end: number;
  reason: string;
  enabled: boolean;
}

export interface PlanShort {
  id: string;
  start: number;
  end: number;
  title: string;
  hook: string;
  reason: string;
  score: number;
  framing: Framing;
  captions: boolean;
  enabled: boolean;
}

export type Preset = 'light' | 'normal' | 'tight';

export interface EditPlan {
  version: 1;
  duration: number;
  preset: Preset;
  cuts: PlanCut[];
  chapters: Chapter[];
  shorts: PlanShort[];
  summary: string;
  notes: string[];
  agent: { ran: boolean; runId?: string; error?: string };
}

/** Minimum pause to shorten and the breath kept on each side of a cut, per preset. */
export const PRESETS: Record<Preset, { floor: number; pad: number }> = {
  light: { floor: 1.2, pad: 0.3 },
  normal: { floor: 0.75, pad: 0.22 },
  tight: { floor: 0.5, pad: 0.15 },
};

const r3 = (n: number) => Math.round(n * 1000) / 1000;

// ─────────────────────────── deterministic cuts ───────────────────────────

/**
 * Long pauses, trimmed from the MIDDLE so both sides keep a breath (cutting flush against
 * speech sounds gasping). Parts of a "silence" where the transcript has words are kept:
 * quiet speech under the noise floor is still speech.
 */
export function deadAirCuts(silences: Span[], duration: number, preset: Preset, words?: Word[]): Span[] {
  const { floor, pad } = PRESETS[preset];
  const cuts: Span[] = [];
  for (const [a, b] of silences) {
    if (b - a < floor) continue;
    const start = a <= 0.05 ? 0 : a + pad; // leading silence goes entirely (minus one breath)
    const end = b >= duration - 0.05 ? duration : b - pad;
    if (end - start > 0.15) cuts.push([start, end]);
  }
  if (!words?.length) return mergeSpans(cuts, duration);
  const speech = mergeSpans(words.map((w) => [w.start - 0.08, w.end + 0.08] as Span), duration);
  const out: Span[] = [];
  for (const [a, b] of cuts) {
    let pieces: Span[] = [[a, b]];
    for (const [s, e] of speech) {
      if (e <= a || s >= b) continue;
      pieces = pieces.flatMap(([x, y]) => (e <= x || s >= y ? [[x, y] as Span] : ([[x, s], [e, y]] as Span[]).filter(([p, q]) => q - p > 0.15)));
    }
    out.push(...pieces);
  }
  return mergeSpans(out, duration);
}

const HESITATION = new Set(
  ['يعني', 'طيب', 'طب', 'اوكي', 'اوك', 'خلاص', 'بس', 'امم', 'اممم', 'ام', 'هممم', 'همم', 'اها', 'اه', 'هاه', 'ها', 'اوه', 'um', 'uh', 'umm', 'uhm', 'er', 'erm', 'ah', 'hmm'].map((w) => normalizeArabic(w)),
);
const HESITATION_PHRASES = /(كيف اقول|شلون اقول|وش اسمه|وش اسمها|ايش اسمه|خلني اشوف|خليني اشوف|لحظه|ثانيه بس|يعني يعني|you know|i mean)/g;
const ELONGATED = /^(ا*م{2,}|ا+ه+|ا{2,}|ه+م+|اوه+|ها+|ه{2,}|م+|u+h+|u+m+|h+m+)$/;

const tokens = (text: string) => normalizeArabic(text).replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);

/** True when a cue is nothing but hesitation ("اممم يعني", "طيب، خلاص"). Affirmations (صح، تمام، إيه) are kept. */
export function isHesitation(text: string): boolean {
  const t = normalizeArabic(text).replace(HESITATION_PHRASES, ' ');
  const words = tokens(t);
  return words.length > 0 && words.every((w) => HESITATION.has(w) || ELONGATED.test(w));
}

/** Hesitation-only cues and restarted sentences (the earlier, abandoned take is cut). */
export function speechCuts(cues: Cue[]): { kind: 'filler' | 'repeat'; span: Span; reason: string }[] {
  const out: { kind: 'filler' | 'repeat'; span: Span; reason: string }[] = [];
  let lastSpeech = -1;
  cues.forEach((c, i) => {
    if (isHesitation(c.text)) {
      out.push({ kind: 'filler', span: [c.start, c.end], reason: c.text.trim().slice(0, 48) });
      return;
    }
    if (lastSpeech >= 0) {
      const prev = cues[lastSpeech]!;
      const a = tokens(prev.text).slice(0, 5);
      const b = tokens(c.text).slice(0, 5);
      // A retake starts the same way; comparing against the last SPEECH cue catches the
      // common case of an "umm" between the two attempts.
      if (a.length >= 3 && a.length === b.length && a.every((w, k) => w === b[k]) && c.start - prev.end < 20) {
        out.push({ kind: 'repeat', span: [prev.start, prev.end], reason: `إعادة: «${prev.text.trim().slice(0, 40)}»` });
      }
    }
    lastSpeech = i;
  });
  return out;
}

// ─────────────────────────── agent prompt and result ───────────────────────────

export const AgentPlanSchema = z.object({
  summary: z.string().describe('ملخص الحلقة في 2-3 جمل'),
  chapters: z.array(z.object({ cue: z.number().int(), title: z.string() })).describe('فصول الحلقة، الأول عند المقطع 0'),
  shorts: z
    .array(
      z.object({
        start_cue: z.number().int(),
        end_cue: z.number().int(),
        title: z.string(),
        hook: z.string().describe('نص الشاشة لأول ثانيتين، مختلف عن الكلام'),
        reason: z.string(),
        score: z.number().int(),
        framing: z.enum(['fit', 'center', 'left', 'right']),
      }),
    )
    .describe('أفضل المقاطع القصيرة'),
  content_cuts: z.array(z.object({ start_cue: z.number().int(), end_cue: z.number().int(), reason: z.string() })).describe('اقتراحات حذف اختيارية'),
  notes: z.array(z.string()).describe('ملاحظات للمؤسس'),
});
export type AgentPlan = z.infer<typeof AgentPlanSchema>;

export interface Unit {
  start: number;
  end: number;
  text: string;
}

/** Transcript units the agent refers to by index. Long transcripts are grouped to fit the context. */
export function planUnits(cues: Cue[], maxChars = 160_000): Unit[] {
  const total = cues.reduce((n, c) => n + c.text.length + 24, 0);
  const group = Math.max(1, Math.ceil(total / maxChars));
  const units: Unit[] = [];
  for (let i = 0; i < cues.length; i += group) {
    const g = cues.slice(i, i + group);
    units.push({ start: g[0]!.start, end: g[g.length - 1]!.end, text: g.map((c) => c.text).join(' ') });
  }
  return units;
}

export function agentTask(input: { episodeTitle: string; topic?: string; guestNote?: string; duration: number; units: Unit[] }): string {
  const lines = input.units.map((u, i) => `[${i}] ${fmtClock(u.start, true)}–${fmtClock(u.end, true)} ${u.text}`);
  return [
    `تجهيز خطة مونتاج لحلقة بودكاست وارد «${input.episodeTitle}»${input.topic ? ` — ${input.topic}` : ''}. مدة التسجيل ${fmtClock(input.duration)}.`,
    input.guestNote ?? '',
    'القص التلقائي للصمت الطويل والتأتأة والجمل المعادة تم بشكل آلي محسوب — لا تكرره.',
    'النص المفرّغ أدناه مقسّم إلى مقاطع مرقّمة [n] مع توقيتها. أشر دائمًا إلى أرقام المقاطع، لا إلى توقيتات من عندك.',
    '',
    'المطلوب:',
    '1) chapters: من 4 إلى 12 فصلًا. الفصل يبدأ عند مقطع يبدأ فيه موضوع جديد، والأول عند المقطع 0. العنوان 2–6 كلمات باللهجة السعودية، وصفي وصادق، بلا مبالغة.',
    '2) shorts: حتى 5 مقاطع قصيرة من start_cue إلى end_cue، طول كل واحد 20–55 ثانية. يبدأ بفكرة مكتملة لا تحتاج ما قبلها، فيه تحوّل (ادعاء ثم ما يعقّده أو يثبته)، وينتهي بجملة لا بكلام متقطع. hook: نص للشاشة في أول ثانيتين (3–7 كلمات) مختلف عن الكلام المنطوق. framing: fit إذا كانت اللقطة عريضة فيها شخصان أو لا تعرف، center لشخص واحد في المنتصف. score من 1 إلى 10.',
    '3) content_cuts: اقتراحات اختيارية فقط — أجزاء خارج الموضوع تمامًا، أو معلومات خاصة يجب ألا تُنشر (رقم جوال، عنوان، اسم مدرسة، تفاصيل عن قاصر)، أو خطأ واضح. لا تقترح حذف كلام جيد. المؤسس هو من يقرر.',
    '4) notes: ملاحظات قصيرة للمؤسس (معلومة تحتاج تحقق، ذكر راعٍ، مشكلة في الصوت ظاهرة من النص).',
    'لا تخترع شيئًا غير موجود في النص.',
    '',
    'النص:',
    ...lines,
  ]
    .filter((l, i, a) => l !== '' || a[i - 1] !== '')
    .join('\n');
}

/** Turn the agent's index-based answer into times, dropping anything out of range or malformed. */
export function applyAgentPlan(ap: AgentPlan, units: Unit[], duration: number): Pick<EditPlan, 'chapters' | 'shorts' | 'summary' | 'notes'> & { contentCuts: PlanCut[] } {
  const ok = (i: number) => Number.isInteger(i) && i >= 0 && i < units.length;
  const chapters = ap.chapters
    .filter((c) => ok(c.cue) && c.title.trim())
    .map((c) => ({ start: c.cue === 0 ? 0 : r3(units[c.cue]!.start), title: c.title.trim().slice(0, 100) }))
    .sort((a, b) => a.start - b.start)
    .slice(0, 20);
  const shorts: PlanShort[] = [];
  for (const s of ap.shorts) {
    if (!ok(s.start_cue) || !ok(s.end_cue) || s.end_cue < s.start_cue) continue;
    const start = r3(Math.max(0, units[s.start_cue]!.start - 0.12));
    let end = r3(Math.min(duration, units[s.end_cue]!.end + 0.3));
    if (end - start > 75) {
      // Too long: end at the last unit that still fits in a minute.
      let j = s.end_cue;
      while (j > s.start_cue && units[j]!.end - start > 60) j--;
      end = r3(Math.min(duration, units[j]!.end + 0.3));
    }
    if (end - start < 10) continue;
    shorts.push({
      id: `s${shorts.length + 1}`,
      start,
      end,
      title: s.title.trim().slice(0, 100),
      hook: s.hook.trim().slice(0, 60),
      reason: s.reason.trim().slice(0, 300),
      score: Math.max(1, Math.min(10, Math.round(s.score))),
      framing: FRAMINGS.includes(s.framing) ? s.framing : 'fit',
      captions: true,
      enabled: true,
    });
    if (shorts.length >= 6) break;
  }
  const contentCuts: PlanCut[] = ap.content_cuts
    .filter((c) => ok(c.start_cue) && ok(c.end_cue) && c.end_cue >= c.start_cue)
    .slice(0, 30)
    .map((c, i) => ({ id: `k${i + 1}`, kind: 'content', start: r3(units[c.start_cue]!.start), end: r3(units[c.end_cue]!.end), reason: c.reason.trim().slice(0, 300), enabled: false }));
  return { chapters, shorts, summary: ap.summary.trim().slice(0, 1500), notes: ap.notes.map((n) => n.trim().slice(0, 400)).filter(Boolean).slice(0, 10), contentCuts };
}

// ─────────────────────────── composing and editing the plan ───────────────────────────

export function composePlan(input: {
  duration: number;
  silences: Span[];
  cues: Cue[];
  words?: Word[];
  preset: Preset;
  agent?: { plan: ReturnType<typeof applyAgentPlan>; runId?: string } | { error: string };
}): EditPlan {
  const cuts: PlanCut[] = [];
  let n = 0;
  for (const [a, b] of deadAirCuts(input.silences, input.duration, input.preset, input.words)) {
    cuts.push({ id: `c${++n}`, kind: 'dead', start: r3(a), end: r3(b), reason: `صمت ${(b - a).toFixed(1)} ث`, enabled: true });
  }
  for (const s of speechCuts(input.cues)) {
    cuts.push({ id: `c${++n}`, kind: s.kind, start: r3(s.span[0]), end: r3(s.span[1]), reason: s.reason, enabled: true });
  }
  const agentOk = input.agent && 'plan' in input.agent ? input.agent : null;
  if (agentOk) for (const c of agentOk.plan.contentCuts) cuts.push({ ...c, id: `c${++n}` });
  cuts.sort((x, y) => x.start - y.start);
  return {
    version: 1,
    duration: input.duration,
    preset: input.preset,
    cuts,
    chapters: agentOk?.plan.chapters ?? [],
    shorts: agentOk?.plan.shorts ?? [],
    summary: agentOk?.plan.summary ?? '',
    notes: agentOk?.plan.notes ?? [],
    agent: agentOk ? { ran: true, runId: agentOk.runId } : { ran: false, error: input.agent && 'error' in input.agent ? input.agent.error : undefined },
  };
}

export function planKeeps(plan: EditPlan): Span[] {
  return keepSegments(plan.duration, plan.cuts.filter((c) => c.enabled).map((c) => [c.start, c.end] as Span));
}

export function planStats(plan: EditPlan) {
  const keeps = planKeeps(plan);
  const out = totalLength(keeps);
  const byKind: Record<string, { count: number; seconds: number }> = {};
  for (const c of plan.cuts.filter((c) => c.enabled)) {
    const k = (byKind[c.kind] ??= { count: 0, seconds: 0 });
    k.count++;
    k.seconds = r3(k.seconds + (c.end - c.start));
  }
  return { input: plan.duration, output: out, removed: r3(plan.duration - out), byKind, segments: keeps.length };
}

/** Chapter lines as the founder edits them: "m:ss Title" (source timeline). */
export function parseChapterLines(text: string): Chapter[] {
  const out: Chapter[] = [];
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*(?:(\d+):)?(\d{1,2}):(\d{2})(?:\.\d+)?\s+(.+)$/.exec(line);
    if (!m) continue;
    out.push({ start: Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]), title: m[4]!.trim().slice(0, 100) });
  }
  return out.sort((a, b) => a.start - b.start).slice(0, 30);
}

export const PlanEditSchema = z.object({
  preset: z.enum(['light', 'normal', 'tight']).optional(),
  cuts: z.array(z.object({ id: z.string().max(12), enabled: z.boolean() })).max(5000).optional(),
  manual_cut: z.object({ start: z.number().min(0), end: z.number().min(0), reason: z.string().max(200).default('') }).optional(),
  remove_cut: z.string().max(12).optional(),
  chapters: z.string().max(5000).optional(),
  shorts: z
    .array(
      z.object({
        id: z.string().max(12),
        enabled: z.boolean().optional(),
        title: z.string().max(100).optional(),
        hook: z.string().max(60).optional(),
        framing: z.enum(['fit', 'center', 'left', 'right']).optional(),
        captions: z.boolean().optional(),
        start: z.number().min(0).optional(),
        end: z.number().min(0).optional(),
      }),
    )
    .max(20)
    .optional(),
});
export type PlanEdit = z.infer<typeof PlanEditSchema>;

/** Apply the founder's edits. Times are clamped; a short must stay between 5 s and 3 min. */
export function editPlan(plan: EditPlan, edit: PlanEdit, rebuild?: (preset: Preset) => PlanCut[]): EditPlan {
  const next: EditPlan = structuredClone(plan);
  if (edit.preset && edit.preset !== next.preset && rebuild) {
    const keep = next.cuts.filter((c) => c.kind === 'content' || c.kind === 'manual');
    next.cuts = [...rebuild(edit.preset), ...keep].sort((a, b) => a.start - b.start);
    next.preset = edit.preset;
  }
  if (edit.cuts) {
    const want = new Map(edit.cuts.map((c) => [c.id, c.enabled]));
    for (const c of next.cuts) if (want.has(c.id)) c.enabled = want.get(c.id)!;
  }
  if (edit.remove_cut) next.cuts = next.cuts.filter((c) => !(c.id === edit.remove_cut && c.kind === 'manual'));
  if (edit.manual_cut) {
    const start = Math.max(0, Math.min(edit.manual_cut.start, next.duration));
    const end = Math.max(0, Math.min(edit.manual_cut.end, next.duration));
    if (end - start >= 0.1) {
      const id = `m${1 + Math.max(0, ...next.cuts.filter((c) => c.id.startsWith('m')).map((c) => Number(c.id.slice(1)) || 0))}`;
      next.cuts.push({ id, kind: 'manual', start: r3(start), end: r3(end), reason: edit.manual_cut.reason || 'قص يدوي', enabled: true });
      next.cuts.sort((a, b) => a.start - b.start);
    }
  }
  if (edit.chapters !== undefined) next.chapters = parseChapterLines(edit.chapters);
  if (edit.shorts) {
    for (const e of edit.shorts) {
      const s = next.shorts.find((x) => x.id === e.id);
      if (!s) continue;
      if (e.enabled !== undefined) s.enabled = e.enabled;
      if (e.title !== undefined) s.title = e.title.trim();
      if (e.hook !== undefined) s.hook = e.hook.trim();
      if (e.framing) s.framing = e.framing;
      if (e.captions !== undefined) s.captions = e.captions;
      const start = e.start ?? s.start;
      const end = e.end ?? s.end;
      if (end - start >= 5 && end - start <= 180 && end <= next.duration + 0.01) {
        s.start = r3(start);
        s.end = r3(Math.min(end, next.duration));
      }
    }
  }
  return next;
}
