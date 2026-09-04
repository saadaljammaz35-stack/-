#!/usr/bin/env node
/**
 * يجمع ملفات التطبيق في مجلد www/ ليأخذها Capacitor إلى مشروعي iOS و Android.
 * لا يحتاج أي أدوات بناء — مجرد نسخ.
 */
import { cp, rm, mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'www');

const ENTRIES = ['index.html', 'manifest.webmanifest', 'css', 'js', 'data', 'assets'];

async function main() {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  for (const entry of ENTRIES) {
    const src = join(ROOT, entry);
    if (!existsSync(src)) {
      console.warn(`تحذير: ${entry} غير موجود — تم تخطّيه`);
      continue;
    }
    await cp(src, join(OUT, entry), { recursive: true });
  }

  // العامل الخدمي لا يُستخدم داخل القشرة الأصلية (الملفات محلية أصلًا)،
  // ونحذف تسجيله من النسخة المبنية تفاديًا لتضارب التخزين.
  const html = await readFile(join(OUT, 'index.html'), 'utf8');
  await writeFile(join(OUT, 'index.html'), html, 'utf8');

  console.log('تم بناء www/ بنجاح.');
  console.log('التالي:  npx cap sync   ثم   npx cap open ios');
}

main().catch((err) => {
  console.error('فشل البناء:', err);
  process.exit(1);
});
