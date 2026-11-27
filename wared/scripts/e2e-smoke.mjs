// End-to-end smoke test for the core listening flows, run against a production build in demo mode:
//
//   NEXT_PUBLIC_DEMO_CONTENT=1 npm run build
//   APP_SECRET=<32+ chars> NEXT_PUBLIC_DEMO_CONTENT=1 npm start -- -p 3105
//   node scripts/e2e-smoke.mjs http://localhost:3105
//
// Requires the `playwright` package and a Chromium build (npx playwright install chromium).
import { createRequire } from 'node:module';

// createRequire also finds a globally installed Playwright (NODE_PATH), which ESM imports do not.
const { chromium } = createRequire(import.meta.url)('playwright');

const base = process.argv[2] ?? 'http://localhost:3105';
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 860 }, permissions: ['clipboard-read', 'clipboard-write'] });
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));

const audioTime = () => page.evaluate(() => document.querySelector('audio')?.currentTime ?? -1);
const audioPaused = () => page.evaluate(() => document.querySelector('audio')?.paused ?? true);

try {
  // 1. Play the latest episode from the home page.
  await page.goto(`${base}/ar`, { waitUntil: 'load' });
  await page.getByRole('button', { name: 'تشغيل', exact: true }).first().click();
  await page.waitForTimeout(2000);
  const t1 = await audioTime();
  check('home: play starts audio', !(await audioPaused()) && t1 > 0.5, `t=${t1.toFixed(1)}`);
  check('mini player appears', await page.getByRole('region', { name: 'يُشغَّل الآن' }).isVisible());

  // 2. Client-side navigation keeps playing.
  await page.getByRole('navigation').getByRole('link', { name: 'الحلقات' }).first().click();
  await page.waitForURL('**/ar/episodes');
  await page.waitForTimeout(1500);
  const t2 = await audioTime();
  check('playback continues across navigation', !(await audioPaused()) && t2 > t1, `t=${t2.toFixed(1)}`);

  // 3. Episode page: chapters, speed, share.
  await page.goto(`${base}/ar/episodes/sample-episode-3`, { waitUntil: 'load' });
  await page.getByRole('button', { name: 'تشغيل', exact: true }).first().click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: /كل شيء وارد/ }).first().click();
  await page.waitForTimeout(600);
  const t3 = await audioTime();
  check('chapter click seeks', t3 >= 12 && t3 < 15, `t=${t3.toFixed(1)}`);
  await page.getByRole('button', { name: /سرعة التشغيل/ }).first().click();
  const rate = await page.evaluate(() => document.querySelector('audio')?.playbackRate);
  check('speed control changes rate', rate === 1.25, `rate=${rate}`);
  await page.getByRole('button', { name: 'رجوع 15 ثانية' }).first().click();
  check('back 15s', (await audioTime()) < 3);
  await page.getByRole('button', { name: /مشاركة لحظة|شارك من/ }).click();
  const clip = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '');
  check('share moment copies a link', /\/ar\/episodes\/sample-episode-3(\?t=\d+)?$/.test(clip), clip);

  // 4. Transcript search filters segments.
  await page.getByRole('searchbox', { name: 'ابحث في النص' }).fill('وارد');
  const segments = await page.locator('#transcript-heading ~ ol li, section[aria-labelledby="transcript-heading"] ol li').count();
  check('transcript search filters', segments === 1, `${segments} segment(s)`);

  // 5. Saved position survives a reload, and the mini player is restored.
  await page.getByRole('button', { name: 'إيقاف مؤقت' }).first().click();
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(800);
  check('player restored after reload', await page.getByRole('region', { name: 'يُشغَّل الآن' }).isVisible());

  // 6. Deep link to a moment.
  const fresh = await context.newPage();
  await fresh.goto(`${base}/ar/episodes/sample-episode-2?t=6`, { waitUntil: 'load' });
  const deepLink = await fresh
    .getByRole('button', { name: 'شغّل من 0:06' })
    .waitFor({ timeout: 8000 })
    .then(() => true)
    .catch(() => false);
  check('?t= deep link offers the moment', deepLink);
  await fresh.close();

  // 7. Mobile menu, language switch and theme toggle.
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const m = await phone.newPage();
  await m.goto(`${base}/ar/about`, { waitUntil: 'load' });
  await m.getByRole('button', { name: 'القائمة' }).click();
  const dialogOpen = await m.locator('dialog[open]').isVisible();
  await m.keyboard.press('Escape');
  check('mobile menu opens and closes', dialogOpen && !(await m.locator('dialog[open]').count()));
  await m.getByRole('button', { name: 'القائمة' }).click();
  await m.locator('dialog[open]').getByRole('link', { name: 'English' }).click();
  await m.waitForURL('**/en/about');
  check('language switch keeps the page', m.url().endsWith('/en/about'));
  check('english page is LTR', (await m.evaluate(() => document.documentElement.dir)) === 'ltr');
  await phone.close();

  await page.goto(`${base}/ar`, { waitUntil: 'load' });
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: /^المظهر/ }).click();
  check('theme toggle sets light', (await page.evaluate(() => document.documentElement.dataset.theme)) === 'light');
  await page.getByRole('button', { name: /^المظهر/ }).click();
  check('theme toggle sets dark', (await page.evaluate(() => document.documentElement.dataset.theme)) === 'dark');

  // 8. Contact form: client validation, then an honest answer when no backend is configured.
  await page.goto(`${base}/ar/contact`, { waitUntil: 'load' });
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'إرسال' }).click();
  check('contact form shows validation errors', (await page.getByRole('alert').count()) >= 2);
  await page.getByLabel('الاسم', { exact: true }).fill('اختبار');
  await page.getByLabel('البريد الإلكتروني', { exact: true }).fill('test@example.com');
  await page.getByLabel('الرسالة', { exact: true }).fill('رسالة اختبار للتحقق من النموذج');
  await page.waitForTimeout(2200); // the signed form token rejects instant submissions
  await page.getByRole('button', { name: 'إرسال' }).click();
  await page.getByRole('status').filter({ hasText: /وصلتنا|غير متاح|تعذّر/ }).waitFor({ timeout: 10000 });
  const status = await page.getByRole('status').filter({ hasText: /وصلتنا|غير متاح|تعذّر/ }).textContent();
  check('contact form answers', Boolean(status), status ?? '');

  // 9. Feeds and machine-readable endpoints.
  const rss = await page.request.get(`${base}/rss.xml`);
  check('rss feed', rss.ok() && (await rss.text()).includes('<enclosure'));
  const chapters = await page.request.get(`${base}/api/episodes/sample-episode-3/chapters`);
  check('json chapters', chapters.ok() && (await chapters.json()).chapters.length === 3);
  const vtt = await page.request.get(`${base}/api/episodes/sample-episode-3/transcript`);
  check('webvtt transcript', vtt.ok() && (await vtt.text()).startsWith('WEBVTT'));
  const admin = await page.request.get(`${base}/admin/episodes`, { maxRedirects: 0 });
  check('admin is not publicly reachable', admin.status() === 307 || admin.status() === 302, `status ${admin.status()}`);
} catch (error) {
  check('unexpected error', false, error instanceof Error ? error.message.split('\n')[0] : String(error));
} finally {
  check('no uncaught page errors', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '));
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
