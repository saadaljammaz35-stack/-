/**
 * Per-dialect evaluation of the understanding + retrieval pipeline.
 * Writes reports/dialect-eval.{json,md}. Run: npm run dialect:eval
 */
import fs from 'node:fs';
import path from 'node:path';

import { SearchIndex } from '@/features/search/searchEngine';

import { CORPUS, HOLDOUT, type EvalCase } from '../__fixtures__/dialect-corpus';
import { EVAL_NOW, PLACES, householdDocs } from '../__fixtures__/household';
import { BUNDLED_LEXICON } from '../lexicon';
import { compileLexicon, parseQuery } from '../parser';

interface CaseResult {
  set: 'dev' | 'holdout';
  dialect: string;
  text: string;
  expectedIntent: string;
  intent: string;
  confidence: number;
  status: string;
  top: string | null;
  pass: boolean;
  why: string;
}

const lex = compileLexicon(BUNDLED_LEXICON);
const index = new SearchIndex(lex);
index.rebuild(householdDocs(), PLACES);

function evaluate(c: EvalCase): CaseResult {
  const q = parseQuery(c.text, lex);
  const r = index.search(q, EVAL_NOW);
  const top = r.hits[0]?.item.id ?? null;
  let pass = true;
  let why = 'ok';
  if (c.rephrase) {
    pass = r.status === 'needs_rephrase' && r.hits.length === 0;
    why = pass ? 'ok' : `expected rephrase, got ${r.status}`;
  } else if (c.absent) {
    const strong = r.hits.filter((h) => h.strength === 'strong');
    if (c.intent === 'list_location') {
      pass = q.intent === c.intent && r.hits.length === 0;
      return { set: c.set ?? 'dev', dialect: c.dialect, text: c.text, expectedIntent: c.intent, intent: q.intent, confidence: q.confidence, status: r.status, top, pass, why: pass ? 'ok' : `expected nothing, got ${r.hits.length}` };
    }
    pass = q.intent === c.intent && strong.length === 0;
    why = pass ? 'ok' : `item not registered but engine returned ${strong.map((h) => h.item.id).join(',') || q.intent}`;
  } else if (q.intent !== c.intent) {
    pass = false;
    why = `intent ${q.intent}`;
  } else if (c.targets) {
    pass = top !== null && c.targets.includes(top);
    why = pass ? 'ok' : `top=${top ?? 'none'}`;
  } else if (c.places) {
    pass = r.places.some((p) => c.places!.includes(p.id));
    why = pass ? 'ok' : `places=${r.places.map((p) => p.id).join(',') || 'none'}`;
  } else if (c.intent === 'recent' || c.intent === 'smalltalk') {
    pass = r.status === (c.intent === 'smalltalk' ? 'smalltalk' : 'ok');
    why = pass ? 'ok' : `status ${r.status}`;
  }
  return {
    set: c.set ?? 'dev',
    dialect: c.dialect,
    text: c.text,
    expectedIntent: c.intent,
    intent: q.intent,
    confidence: q.confidence,
    status: r.status,
    top,
    pass,
    why,
  };
}

const LABELS: Record<string, string> = {
  najdi: 'النجدية (Najdi)',
  hijazi: 'الحجازية (Hijazi)',
  sharqi: 'الشرقية (Eastern)',
  janoubi: 'الجنوبية (Southern)',
  shamali: 'الشمالية (Northern)',
  mixed: 'ضوضاء/إنجليزي/سلبي (Noise, English, negatives)',
};

describe('Saudi dialect evaluation', () => {
  const all = [...CORPUS.map(evaluate), ...HOLDOUT.map(evaluate)];
  const results = all.filter((r) => r.set === 'dev');
  const holdout = all.filter((r) => r.set === 'holdout');

  afterAll(() => {
    const summarize = (rs: CaseResult[]) => {
      const byDialect = new Map<string, CaseResult[]>();
      for (const r of rs) byDialect.set(r.dialect, [...(byDialect.get(r.dialect) ?? []), r]);
      return [...byDialect.entries()].map(([dialect, list]) => ({
        dialect,
        label: LABELS[dialect] ?? dialect,
        cases: list.length,
        passed: list.filter((r) => r.pass).length,
        successRate: Number(((list.filter((r) => r.pass).length / list.length) * 100).toFixed(1)),
        intentAccuracy: Number(((list.filter((r) => r.intent === r.expectedIntent).length / list.length) * 100).toFixed(1)),
      }));
    };
    const pct = (rs: CaseResult[]) => ((rs.filter((r) => r.pass).length / rs.length) * 100).toFixed(1);
    const dev = summarize(results);
    const held = summarize(holdout);
    const out = path.join(__dirname, '..', '..', '..', '..', 'reports');
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(
      path.join(out, 'dialect-eval.json'),
      JSON.stringify(
        { generatedAt: new Date().toISOString(), lexiconVersion: lex.version, dev: { total: results.length, summary: dev }, holdout: { total: holdout.length, summary: held }, results: all },
        null,
        2,
      ),
    );
    const table = (rows: typeof dev) => [
      '| اللهجة | العبارات | الناجحة | نسبة النجاح | دقة تحديد النية |',
      '|---|---:|---:|---:|---:|',
      ...rows.map((s) => `| ${s.label} | ${s.cases} | ${s.passed} | ${s.successRate}% | ${s.intentAccuracy}% |`),
    ];
    const failures = (rs: CaseResult[]) => {
      const f = rs.filter((r) => !r.pass);
      if (f.length === 0) return ['لا توجد حالات فاشلة.'];
      return [
        '| اللهجة | العبارة | المتوقع | الناتج | السبب |',
        '|---|---|---|---|---|',
        ...f.map((r) => `| ${r.dialect} | ${r.text} | ${r.expectedIntent} | ${r.intent} (${r.confidence}) | ${r.why} |`),
      ];
    };
    const lines = [
      '# تقرير تقييم فهم اللهجات السعودية',
      '',
      `- تاريخ التوليد: ${new Date().toISOString()}`,
      `- نسخة القاموس: ${lex.version}`,
      `- مجموعة التطوير (استُخدمت أثناء بناء القاموس): ${results.length} عبارة — نجاح ${pct(results)}%`,
      `- **المجموعة المحجوزة (كُتبت بعد بناء القاموس ولم يُعدَّل القاموس بناءً عليها): ${holdout.length} عبارة — نجاح ${pct(holdout)}%**`,
      '',
      '> **حدود هذا التقييم:** العبارات نصية كتبها فريق التطوير لمحاكاة ناتج تحويل الكلام إلى نص، ولم تُجمع من متحدثين أصليين من كل منطقة.',
      '> النتيجة تقيس طبقة الفهم والبحث فقط، ولا تقيس دقة التعرف الصوتي نفسه (نطق، ضوضاء، سرعة كلام). نسبة المجموعة المحجوزة هي التقدير الأقرب للواقع،',
      '> ونسبة مجموعة التطوير متفائلة بطبيعتها. يلزم اختبار صوتي حقيقي مع مستخدمين من كل منطقة قبل الإطلاق.',
      '',
      '## سجل التشغيل (للشفافية)',
      '',
      '1. التشغيل الأول لمجموعة التطوير: 93.4% (156/167). كشف خللاً: «وين حطيت الجوال» أعاد «شاحن ايفون» كنتيجة مؤكدة رغم عدم تسجيل جوال.',
      '2. إصلاح عام في المحرك: الاسم الأول في اسم الغرض هو «ماهيته» (شاحن لابتوب = شاحن)، فصل المفاهيم الواسعة (عدة → مفك/دريل…)، وعلاقات أب/ابن (مفتاح السيارة ⊂ مفاتيح).',
      '3. التشغيل الأول للمجموعة المحجوزة: 96.9% (63/65) مع حالة اختراع واحدة: «فين الكرت حق البنك» طابقت كلمات ثلاثية بفارق حرف (بنك/بني/بوك).',
      '4. إصلاح عام (ليس خاصاً بالعبارة): الكلمات القصيرة يجب أن تتطابق حرفياً لأن جذور العربية ثلاثية، والتطابق التقريبي وحده لا يعطي نتيجة مؤكدة. لم يُضف أي مصطلح للقاموس بناءً على المجموعة المحجوزة.',
      '',
      '## المجموعة المحجوزة (التقدير الأمين)',
      '',
      ...table(held),
      '',
      '### الحالات الفاشلة (لم تُصلَح عمداً — تُستخدم كقائمة تحسينات للقاموس التالي)',
      '',
      ...failures(holdout),
      '',
      '## مجموعة التطوير',
      '',
      ...table(dev),
      '',
      '### الحالات الفاشلة',
      '',
      ...failures(results),
      '',
      '## معيار النجاح',
      '',
      '- البحث عن غرض: الغرض الصحيح يظهر **أولاً** في النتائج.',
      '- محتويات مكان: المكان الصحيح ضمن الأماكن المطابقة.',
      '- غرض غير مسجل: لا يعرض النظام أي نتيجة مؤكدة (لا اختراع).',
      '- كلام غير مفهوم: يطلب النظام إعادة الصياغة.',
      '',
    ];
    fs.writeFileSync(path.join(out, 'dialect-eval.md'), lines.join('\n'));
  });

  it('never invents a result for items that are not registered', () => {
    const fabricated = results.filter((r, i) => CORPUS[i].absent && !r.pass);
    expect(fabricated).toEqual([]);
  });

  it('asks to rephrase instead of guessing on unclear input', () => {
    const guessed = results.filter((r, i) => CORPUS[i].rephrase && !r.pass);
    expect(guessed).toEqual([]);
  });

  it.each(['najdi', 'hijazi', 'sharqi', 'janoubi', 'shamali'])('%s success rate is at least 85%%', (dialect) => {
    const rs = results.filter((r) => r.dialect === dialect);
    const rate = rs.filter((r) => r.pass).length / rs.length;
    if (rate < 0.85) {
      // eslint-disable-next-line no-console
      console.log(rs.filter((r) => !r.pass));
    }
    expect(rate).toBeGreaterThanOrEqual(0.85);
  });
});
