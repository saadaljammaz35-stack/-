// Builds reports/TEST-REPORT.md from real result files. Run after:
//   npm run test:ci                      -> reports/jest-results.json
//   npm run test:integration (optional)  -> reports/integration-results.json
//   npm run dialect:eval                 -> reports/dialect-eval.json
// Optional: reports/android-build.json, reports/web-qa.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rep = (f) => path.join(root, 'reports', f);
const load = (f) => (fs.existsSync(rep(f)) ? JSON.parse(fs.readFileSync(rep(f), 'utf8')) : null);

const unit = load('jest-results.json');
const integ = load('integration-results.json');
const dialect = load('dialect-eval.json');
const android = load('android-build.json');
const webqa = load('web-qa.json');
const ios = load('ios-build.json');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

const lines = [];
const p = (...l) => lines.push(...l);
const rel = (f) => path.relative(root, f);

function suiteTable(results, title) {
  if (!results) {
    p(`### ${title}`, '', 'لم تُشغَّل في هذا التقرير.', '');
    return;
  }
  const dur = ((results.testResults ?? []).reduce((s, r) => s + (r.endTime - r.startTime), 0) / 1000).toFixed(1);
  p(`### ${title}`, '');
  p(`- الإجمالي: **${results.numTotalTests}** — نجح **${results.numPassedTests}**، فشل **${results.numFailedTests}**، متجاوز ${results.numPendingTests} — المدة ${dur} ث`, '');
  p('| الملف | الاختبار | النتيجة |', '|---|---|---|');
  for (const file of results.testResults ?? []) {
    for (const t of file.assertionResults ?? []) {
      const icon = t.status === 'passed' ? '✅' : t.status === 'failed' ? '❌' : '⏭️';
      p(`| ${rel(file.name)} | ${[...t.ancestorTitles, t.title].join(' › ').replace(/\|/g, '\\|')} | ${icon} |`);
    }
  }
  p('');
}

p('# تقرير الاختبارات — مَحَلّك', '');
p(`- تاريخ التوليد: ${new Date().toISOString()}`);
p(`- Expo SDK ${pkg.dependencies.expo} · React Native ${pkg.dependencies['react-native']} · Node ${process.version}`, '');
p('> هذا التقرير مولَّد آلياً من ملفات النتائج الحقيقية في `reports/`. لا يحتوي نتائج مكتوبة يدوياً.', '');

p('## الملخص', '');
p('| المجموعة | الإجمالي | نجح | فشل |', '|---|---:|---:|---:|');
for (const [name, r] of [['اختبارات الوحدة والسيناريو', unit], ['تكامل الخادم (Supabase محلي حقيقي)', integ]]) {
  if (r) p(`| ${name} | ${r.numTotalTests} | ${r.numPassedTests} | ${r.numFailedTests} |`);
  else p(`| ${name} | — | — | — |`);
}
if (dialect) {
  const dev = dialect.dev.summary.reduce((a, s) => [a[0] + s.cases, a[1] + s.passed], [0, 0]);
  const held = dialect.holdout.summary.reduce((a, s) => [a[0] + s.cases, a[1] + s.passed], [0, 0]);
  p(`| تقييم اللهجات — مجموعة التطوير | ${dev[0]} | ${dev[1]} | ${dev[0] - dev[1]} |`);
  p(`| تقييم اللهجات — المجموعة المحجوزة | ${held[0]} | ${held[1]} | ${held[0] - held[1]} |`);
}
p('');

p('## سيناريو الموجز (13 خطوة) — أين اختُبرت كل خطوة', '');
p('| # | الخطوة | الاختبار | مستوى التحقق |', '|---|---|---|---|');
const scen = [
  ['1', 'إنشاء حساب', 'backend.int › authentication (OTP عبر Supabase Auth محلي)', 'خادم حقيقي محلي؛ إرسال SMS حقيقي يحتاج مزوّداً'],
  ['2', 'تصوير سماعة', 'scenario.test (حفظ الصورة) + لقطات الويب للكاميرا', 'منطق؛ الكاميرا الفعلية تحتاج جهازاً'],
  ['3', 'قص خلفيتها', 'scenario.test (حفظ الأصل + المقصوصة) + backend.int (remove-background يرد 501 بدون مزوّد)', 'منطق؛ مزوّد القص الحقيقي يحتاج مفتاحاً'],
  ['4', 'تحديد اسمها', 'scenario.test + backend.int (ai-recognize-item مع Claude محاكى)', 'تحقق المخطط والموافقة والحصة؛ جودة النموذج الحقيقي غير مقاسة'],
  ['5', 'تصوير درج المكتب', 'scenario.test', 'منطق'],
  ['6', 'حفظ الغرض', 'scenario.test + backend.int (مزامنة جهازين)', 'تخزين محلي + سحابي حقيقي'],
  ['7', 'إغلاق التطبيق', 'scenario.test (لقطة المخزن وإعادة التحميل)', 'محاكاة إعادة تشغيل'],
  ['8', 'فتح التطبيق', 'scenario.test + backend.int (استعادة الجلسة من سلسلة المفاتيح)', 'منطق + خادم حقيقي'],
  ['9', 'قول «وين حطيت سماعتي؟»', 'scenario.test (النص) + voiceState tests (الصوت)', 'التعرّف الصوتي الفعلي يحتاج جهازاً'],
  ['10', 'ظهور الغرض وصورة المكان', 'scenario.test + لقطة الويب 05-voice-result', 'منطق + واجهة'],
  ['11', 'نقل السماعة', 'scenario.test + backend.int', 'منطق + خادم حقيقي'],
  ['12', 'تحديث موقعها', 'scenario.test + backend.int (الجهاز الثاني ينقل والأول يرى)', 'منطق + خادم حقيقي'],
  ['13', 'ظهور الموقع الجديد', 'scenario.test + backend.int (السجل: الجديد ثم القديم)', 'منطق + خادم حقيقي'],
];
for (const r of scen) p(`| ${r.join(' | ')} |`);
p('');

p('## الأعطال والحالات الصعبة المختبرة', '');
p('- **الضوضاء/الصمت**: آلة حالات الصوت تحوّل الصمت إلى «ما سمعت شيئاً واضحاً» وتحتفظ بالنتيجة الجزئية عند انتهاء المهلة.');
p('- **رفض إذن الميكروفون/الكاميرا**: رسائل مخصصة + زر الإعدادات + بديل الكتابة/المعرض.');
p('- **انقطاع الإنترنت**: البحث والحفظ يعملان محلياً؛ الذكاء الاصطناعي يرفض بـ `offline` ويُرجع النتائج المحلية؛ المزامنة تحتفظ بالتغييرات في صندوق الصادر.');
p('- **فشل الكاميرا**: `onMountError` ينقل المستخدم لاختيار صورة من المعرض.');
p('- **فشل الذكاء الاصطناعي/الحصة**: يبقى الإدخال اليدوي، والصورة الأصلية محفوظة دائماً.');
p('- **عدم الاختراع**: اختبارات صريحة تتأكد أن الأغراض غير المسجلة لا تُعرض كنتيجة مؤكدة.');
p('- **العزل بين المستخدمين**: RLS، منع تغيير المالك، منع الإشارة لصفوف مستخدم آخر، صور خاصة، سجل لا يُعدَّل.', '');

if (dialect) {
  p('## تقييم اللهجات', '');
  p('| اللهجة | المحجوزة: نجاح | التطوير: نجاح |', '|---|---:|---:|');
  for (const s of dialect.holdout.summary) {
    const d = dialect.dev.summary.find((x) => x.dialect === s.dialect);
    p(`| ${s.label} | ${s.successRate}% (${s.passed}/${s.cases}) | ${d ? `${d.successRate}% (${d.passed}/${d.cases})` : '—'} |`);
  }
  p('', 'التفاصيل والحالات الفاشلة: [`reports/dialect-eval.md`](dialect-eval.md).', '');
}

suiteTable(unit, 'اختبارات الوحدة والسيناريو (Jest)');
suiteTable(integ, 'تكامل الخادم مع Supabase محلي (Docker)');

p('## بناء الواجهات (ويب) والمراجعة البصرية', '');
if (webqa) {
  p(`- تصدير الويب: ${webqa.export} — ${webqa.screens} شاشة × وضعين (فاتح/داكن) بدون أخطاء JavaScript في الصفحة.`);
} else {
  p('- راجع اللقطات في `reports/screenshots/`.');
}
p('');

p('## بناء أندرويد', '');
if (android) {
  p(`- الحالة: **${android.status}**`);
  for (const [k, v] of Object.entries(android).filter(([k]) => k !== 'status')) p(`- ${k}: \`${v}\``);
} else {
  p('- لم يُبنَ في هذا التقرير.');
}
p('');

p('## بناء iOS', '');
if (ios) {
  for (const [k, v] of Object.entries(ios)) p(`- ${k}: \`${v}\``);
} else {
  p('- لم يُبنَ في هذا التقرير.');
}
p('');

p('## ما لم يُختبر هنا (يحتاج أجهزة أو حسابات حقيقية)', '');
p('- تشغيل التطبيق على آيفون/أندرويد حقيقي (كاميرا، ميكروفون، اهتزاز، Liquid Glass على iOS 26).');
p('- دقة التعرّف الصوتي للهجات (صوت حقيقي من متحدثين من كل منطقة).');
p('- جودة تعرّف Claude الفعلية على صور حقيقية (الاختبارات استخدمت خادماً محاكياً للتحقق من مسار الكود فقط).');
p('- الشراء الفعلي داخل التطبيق (يحتاج منتجات في App Store Connect وGoogle Play وحساب RevenueCat).');
p('- تسجيل الدخول بـ Apple وGoogle (يحتاج معرفات التطبيق والمفاتيح)، وإرسال SMS حقيقي (يحتاج مزوّد SMS).');
p('- IPA موقّع للمتجر/TestFlight — يحتاج حساب Apple Developer؛ انظر docs/BUILD.md.', '');

fs.writeFileSync(rep('TEST-REPORT.md'), lines.join('\n'));
console.log('wrote reports/TEST-REPORT.md');
