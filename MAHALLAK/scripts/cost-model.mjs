// MAHALLAK cost model — reproducible. Run: node scripts/cost-model.mjs
// Every input below is an assumption; change it and re-run. Sources/verification notes in docs/COST-MODEL.md.

const SAR_PER_USD = 3.75; // pegged
const VAT = 0.15; // Saudi VAT, included in store prices
const STORE_FEE = 0.15; // Apple Small Business Program / Google Play first $1M

// Claude API list prices, USD per million tokens (Anthropic first-party, cached 2026-11-03)
const MODELS = {
  'claude-opus-5-5': { in: 4.0, out: 20.0, label: 'Claude Opus 5.5 (default in code)' },
  'claude-haiku-5-5': { in: 0.1, out: 0.5, label: 'Claude Haiku 5.5 (owner option)' },
};

// Token estimates per operation. Images: ~ width*height/750 tokens; photos are sent at 1024 px max.
const OPS = {
  recognize: { in: 1049 + 700, out: 450, label: 'تعرّف على غرض واحد (صورة 1024×768)' },
  detect: { in: 1049 + 800, out: 1800, label: 'Smart Room Memory (حتى 20 غرضاً)' },
  query: { in: 600, out: 250, label: 'فهم سؤال غير واضح (نص فقط)' },
};
const CUTOUT_USD = 0.02; // background removal provider, per image (estimate — verify the provider's current price)

// Infrastructure (Supabase Pro), per active synced user per month
const SUPABASE_BASE_USD = 25;
const ACTIVE_USERS = 2000;
const TYPICAL_PHOTO_GB = 0.11; // ~150 items + 40 places, compressed
const STORAGE_USD_PER_GB = 0.021;
const EGRESS_GB_PER_MONTH = 0.05;
const EGRESS_USD_PER_GB = 0.09;
const infraMonthly = SUPABASE_BASE_USD / ACTIVE_USERS + TYPICAL_PHOTO_GB * STORAGE_USD_PER_GB + EGRESS_GB_PER_MONTH * EGRESS_USD_PER_GB;
const infraMonthlyWorst = infraMonthly + (1.0 - TYPICAL_PHOTO_GB) * STORAGE_USD_PER_GB; // user at the 1 GB cap

const CREDIT_FULL = { recognize: 80, cutout: 30, detect: 8, query: 80 };
const CREDIT_FREE = { recognize: 5, cutout: 5, detect: 1, query: 10 };

const opCost = (model, op) => (OPS[op].in * MODELS[model].in + OPS[op].out * MODELS[model].out) / 1e6;
const creditCost = (model, c, withCutout = true) =>
  c.recognize * opCost(model, 'recognize') + c.detect * opCost(model, 'detect') + c.query * opCost(model, 'query') + (withCutout ? c.cutout * CUTOUT_USD : 0);
const net = (sar) => ((sar / (1 + VAT)) * (1 - STORE_FEE)) / SAR_PER_USD;
const usd = (n) => `$${n.toFixed(n < 0.1 ? 4 : 2)}`;

const out = [];
out.push('## جداول محسوبة (scripts/cost-model.mjs)', '');
out.push('### 1) صافي الإيراد لكل عملية شراء', '');
out.push('| السعر | بعد ضريبة القيمة المضافة 15% | بعد عمولة المتجر 15% | بالدولار |', '|---|---:|---:|---:|');
for (const p of [19, 29, 39]) {
  const exVat = p / (1 + VAT);
  out.push(`| ${p} ر.س | ${exVat.toFixed(2)} ر.س | ${(exVat * (1 - STORE_FEE)).toFixed(2)} ر.س | ${usd(net(p))} |`);
}
out.push('', '### 2) تكلفة كل عملية ذكاء اصطناعي', '');
out.push('| العملية | توكنات (دخل/خرج) | ' + Object.values(MODELS).map((m) => m.label).join(' | ') + ' |');
out.push('|---|---:|' + Object.keys(MODELS).map(() => '---:').join('|') + '|');
for (const op of Object.keys(OPS)) {
  out.push(`| ${OPS[op].label} | ${OPS[op].in} / ${OPS[op].out} | ` + Object.keys(MODELS).map((m) => usd(opCost(m, op))).join(' | ') + ' |');
}
out.push(`| قص الخلفية (مزوّد خارجي) | — | ${usd(CUTOUT_USD)} | ${usd(CUTOUT_USD)} |`);
out.push('', '### 3) تكلفة الرصيد المشمول (أقصى استخدام ممكن)', '');
out.push('| الباقة | الرصيد | ' + Object.values(MODELS).map((m) => m.label).join(' | ') + ' |');
out.push('|---|---|' + Object.keys(MODELS).map(() => '---:').join('|') + '|');
const fmtCredit = (c) => `${c.recognize} تعرّف، ${c.cutout} قص خلفية، ${c.detect} مسح، ${c.query} سؤال`;
out.push(`| المجانية | ${fmtCredit(CREDIT_FREE)} | ` + Object.keys(MODELS).map((m) => usd(creditCost(m, CREDIT_FREE))).join(' | ') + ' |');
out.push(`| الكاملة | ${fmtCredit(CREDIT_FULL)} | ` + Object.keys(MODELS).map((m) => usd(creditCost(m, CREDIT_FULL))).join(' | ') + ' |');
out.push('', '### 4) البنية التحتية لكل مستخدم يستخدم النسخ السحابي', '');
out.push(`- شهرياً (مستخدم نموذجي): ${usd(infraMonthly)} — سنوياً ${usd(infraMonthly * 12)} — خلال 5 سنوات ${usd(infraMonthly * 60)}`);
out.push(`- شهرياً (مستخدم وصل حد 1 جيجابايت): ${usd(infraMonthlyWorst)} — خلال 5 سنوات ${usd(infraMonthlyWorst * 60)}`);
out.push('', '### 5) هل التكلفة مغطاة؟ (أسوأ حالة: كل الرصيد + 5 سنوات بنية تحتية بحد التخزين)', '');
out.push('| السعر | صافي | ' + Object.values(MODELS).map((m) => m.label).join(' | ') + ' |');
out.push('|---|---:|' + Object.keys(MODELS).map(() => '---:').join('|') + '|');
for (const p of [19, 29, 39]) {
  const cells = Object.keys(MODELS).map((m) => {
    const cost = creditCost(m, CREDIT_FULL) + infraMonthlyWorst * 60;
    const margin = net(p) - cost;
    return `${usd(cost)} → ${margin >= 0 ? 'مغطاة ✅' : 'غير مغطاة ❌'} (${margin >= 0 ? '+' : ''}${margin.toFixed(2)})`;
  });
  out.push(`| ${p} ر.س | ${usd(net(p))} | ${cells.join(' | ')} |`);
}
out.push('', '### 6) لو كان الرصيد شهرياً متجدداً (للمقارنة فقط — لا نعد به)', '');
for (const m of Object.keys(MODELS)) {
  const monthly = creditCost(m, { recognize: 20, cutout: 10, detect: 2, query: 20 });
  out.push(`- ${MODELS[m].label}: استخدام شهري متوسط (20 تعرّف، 10 قص، 2 مسح، 20 سؤال) = ${usd(monthly)}/شهر → ${usd(monthly * 12)}/سنة. ` +
    `أشهر يغطيها سعر 29 ر.س: ${Math.floor(net(29) / (monthly + infraMonthly))}`);
}
console.log(out.join('\n'));
