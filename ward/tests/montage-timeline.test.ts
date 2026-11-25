import { describe, expect, it } from 'vitest';
import { buildShortAss, captionChunks, clipSegments, finalizeChapters, keepSegments, mapTime, parseTranscript, remapCues, toSrt, totalLength } from '@/lib/media/timeline';
import { AgentPlanSchema, applyAgentPlan, composePlan, deadAirCuts, editPlan, isHesitation, parseChapterLines, planKeeps, planUnits, speechCuts } from '@/lib/media/plan';

describe('montage timeline', () => {
  it('keeps the complement of the cuts and drops slivers', () => {
    expect(keepSegments(60, [[10, 20], [20.1, 30], [50, 70]])).toEqual([[0, 10], [30, 50]]);
    expect(totalLength(keepSegments(60, [[10, 20]]))).toBe(50);
  });

  it('maps source time onto the edited timeline', () => {
    const keeps = keepSegments(60, [[10, 20], [30, 40]]); // [0,10] [20,30] [40,60]
    expect(mapTime(5, keeps)).toBe(5);
    expect(mapTime(15, keeps)).toBe(10); // inside a cut → the cut point
    expect(mapTime(25, keeps)).toBe(15);
    expect(mapTime(45, keeps)).toBe(25);
    const cues = remapCues([{ start: 8, end: 12, text: 'a' }, { start: 12, end: 18, text: 'gone' }, { start: 41, end: 43, text: 'b' }], keeps);
    expect(cues).toEqual([{ start: 8, end: 10, text: 'a' }, { start: 21, end: 23, text: 'b' }]);
    expect(clipSegments(keeps, 5, 25)).toEqual([[5, 10], [20, 25]]);
  });

  it('reads SRT, VTT and whisper JSON', () => {
    const srt = '1\n00:00:01,000 --> 00:00:02,500\nمرحبا بكم\n\n2\n00:00:03,000 --> 00:00:04,000\nفي وارد\n';
    expect(parseTranscript(srt, 'a.srt')).toEqual([{ start: 1, end: 2.5, text: 'مرحبا بكم' }, { start: 3, end: 4, text: 'في وارد' }]);
    const vtt = 'WEBVTT\n\n00:01.000 --> 00:02.000\n<c>hello</c> there\n';
    expect(parseTranscript(vtt, 'a.vtt')).toEqual([{ start: 1, end: 2, text: 'hello there' }]);
    expect(parseTranscript(JSON.stringify({ segments: [{ start: 0, end: 1, text: ' x ' }] }), 'a.json')).toEqual([{ start: 0, end: 1, text: 'x' }]);
    expect(toSrt([{ start: 61.5, end: 62, text: 'x' }])).toBe('1\n00:01:01,500 --> 00:01:02,000\nx\n');
  });

  it('only exports chapters YouTube will render', () => {
    const keeps = keepSegments(300, [[100, 130]]);
    const ok = finalizeChapters([{ start: 5, title: 'البداية' }, { start: 60, title: 'القناة' }, { start: 140, title: 'الأحلام' }, { start: 145, title: 'قريب جدًا' }], keeps);
    expect(ok.valid).toBe(true);
    expect(ok.chapters.map((c) => [c.start, c.title])).toEqual([[0, 'البداية'], [60, 'القناة'], [110, 'الأحلام']]);
    expect(finalizeChapters([{ start: 0, title: 'one' }], keeps).valid).toBe(false);
  });

  it('builds right-to-left captions in the WARD typeface for a short', () => {
    const cues = [{ start: 10, end: 14, text: 'ضيفنا اليوم بدأ قناته وهو صغير جدا' }, { start: 20, end: 22, text: 'محذوف' }, { start: 30, end: 33, text: 'وصارت أكبر من عمره' }];
    const ass = buildShortAss({ cues, segments: [[10, 15], [29, 34]], hook: 'بدأ وعمره ١٢ سنة!' });
    expect(ass).toContain('PlayResX: 1080');
    expect(ass).toMatch(/Style: Cap,WARD Type Original,.*,-1$/m); // Encoding -1 → base direction from the text
    expect(ass).toContain('Hook,,0,0,0,,بدأ وعمره ١٢ سنة!');
    expect(ass).not.toContain('محذوف'); // inside a cut
    // The second segment starts at 5 s of output time.
    expect(ass).toMatch(/Dialogue: 0,0:00:0[5-6]\.\d\d,.*,Cap,,0,0,0,,وصارت/);
    const chunks = captionChunks(cues, undefined, 10, 14);
    expect(chunks.every((c) => c.text.split(' ').length <= 4)).toBe(true);
  });
});

describe('montage plan', () => {
  it('trims pauses from the middle and never cuts over transcribed words', () => {
    expect(deadAirCuts([[0, 2], [10, 12], [20, 20.5], [58, 60]], 60, 'normal')).toEqual([[0, 1.78], [10.22, 11.78], [58.22, 60]]);
    // Quiet speech inside a "silence" is kept.
    const cuts = deadAirCuts([[10, 14]], 60, 'normal', [{ start: 11.5, end: 12, word: 'همس' }]);
    expect(cuts).toEqual([[10.22, 11.42], [12.08, 13.78]]);
  });

  it('cuts hesitations and the abandoned take of a restarted sentence', () => {
    expect(isHesitation('اممم… يعني')).toBe(true);
    expect(isHesitation('طيب، خلاص')).toBe(true);
    expect(isHesitation('صح')).toBe(false); // an answer, not filler
    expect(isHesitation('يعني القناة كبرت')).toBe(false);
    const cuts = speechCuts([
      { start: 0, end: 3, text: 'ضيفنا اليوم بدأ قناته وهو صغير' },
      { start: 3.5, end: 4, text: 'امم' },
      { start: 4.5, end: 9, text: 'ضيفنا اليوم بدأ قناته وهو صغير جدًا وعمره ١٢ سنة' },
    ]);
    expect(cuts.map((c) => [c.kind, c.span])).toEqual([['filler', [3.5, 4]], ['repeat', [0, 3]]]);
  });

  it('turns the agent answer (cue indices) into validated times', () => {
    const cues = Array.from({ length: 40 }, (_, i) => ({ start: i * 3, end: i * 3 + 2.8, text: `جملة ${i}` }));
    const units = planUnits(cues);
    const ap = AgentPlanSchema.parse({
      summary: 'ملخص',
      chapters: [{ cue: 0, title: 'المقدمة' }, { cue: 10, title: 'البداية' }, { cue: 999, title: 'خارج النطاق' }],
      shorts: [
        { start_cue: 5, end_cue: 14, title: 'لحظة', hook: 'بدأ صغير', reason: 'تحوّل', score: 9, framing: 'center' },
        { start_cue: 2, end_cue: 3, title: 'قصير جدًا', hook: '', reason: '', score: 3, framing: 'fit' },
        { start_cue: 0, end_cue: 39, title: 'طويل', hook: '', reason: '', score: 5, framing: 'fit' },
      ],
      content_cuts: [{ start_cue: 20, end_cue: 21, reason: 'رقم جوال' }],
      notes: ['تحقق من الرقم'],
    });
    const r = applyAgentPlan(ap, units, 120);
    expect(r.chapters).toEqual([{ start: 0, title: 'المقدمة' }, { start: 30, title: 'البداية' }]);
    expect(r.shorts.map((s) => [s.title, s.start, s.end])).toEqual([['لحظة', 14.88, 45.1], ['طويل', 0, 60.1]]); // too-short dropped, too-long trimmed to ≤ 60 s
    expect(r.contentCuts[0]).toMatchObject({ kind: 'content', start: 60, end: 65.8, enabled: false }); // suggestion only
    const plan = composePlan({ duration: 120, silences: [[100, 104]], cues, preset: 'normal', agent: { plan: r, runId: 'run' } });
    expect(plan.cuts.filter((c) => c.kind === 'content').every((c) => !c.enabled)).toBe(true);
    expect(planKeeps(plan)).toEqual([[0, 100.22], [103.78, 120]]);
  });

  it('applies the founder edits safely', () => {
    const plan = composePlan({ duration: 100, silences: [[10, 14]], cues: [], preset: 'normal' });
    const withManual = editPlan(plan, { manual_cut: { start: 50, end: 55, reason: '' } });
    expect(withManual.cuts.find((c) => c.kind === 'manual')).toMatchObject({ start: 50, end: 55, enabled: true });
    const off = editPlan(withManual, { cuts: [{ id: plan.cuts[0]!.id, enabled: false }], chapters: '0:00 المقدمة\n1:05 القصة\nكلام بدون وقت' });
    expect(off.cuts[0]!.enabled).toBe(false);
    expect(off.chapters).toEqual([{ start: 0, title: 'المقدمة' }, { start: 65, title: 'القصة' }]);
    expect(parseChapterLines('1:02:03 طويل')).toEqual([{ start: 3723, title: 'طويل' }]);
  });
});
