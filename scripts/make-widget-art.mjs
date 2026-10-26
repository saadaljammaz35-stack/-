// Draws the weekday names for the prayer widget in Amiri Bold (OFL), stretched with kashida
// before the last joining letter, as transparent PNGs (one for light and one for dark widget
// backgrounds). Widgets cannot load fonts, so they show these images. Run after changing
// the font or the names; the PNGs are committed.
//   node scripts/make-widget-art.mjs
import { mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Playwright is a dev tool here, resolved like CommonJS (it may be installed globally).
const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'assets/widgets');
// Index = JavaScript weekday (0 = Sunday). The kashida goes where «|» is.
const DAYS = ['الأحـ|د', 'الاثنيـ|ن', 'الثلاثـ|اء', 'الأربعـ|اء', 'الخميـ|س', 'الجمعـ|ة', 'السبـ|ت'];
const INKS = { light: '#141414', dark: '#F4F1E8' };
// Every name is stretched to the same width so the widget shows them at one size.
const W = 900;
const H = 420;

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await page.setContent(`<!doctype html><html dir="rtl"><head><meta charset="utf-8"><style>
@font-face { font-family: Display; src: url(data:font/ttf;base64,${readFileSync(join(ROOT, 'node_modules/@expo-google-fonts/amiri/700Bold/Amiri_700Bold.ttf')).toString('base64')}); }
html,body{margin:0;background:transparent;width:${W}px;height:${H}px;overflow:hidden}
#t{font-family:Display;font-size:150px;line-height:1.5;white-space:nowrap;position:absolute;right:0;top:0;padding:0 14px}
</style></head><body><span id="t">.</span></body></html>`);
await page.evaluate(() => document.fonts.ready);
if (!(await page.evaluate(() => document.fonts.check('150px Display', 'الاثنين')))) throw new Error('Amiri did not load');
for (const [i, day] of DAYS.entries()) {
  for (const [mode, ink] of Object.entries(INKS)) {
    // Add kashida until the word spans the image, like a hand-stretched title.
    await page.evaluate(([day, ink, target]) => {
      const el = document.getElementById('t');
      el.style.color = ink;
      let n = 0;
      do {
        el.textContent = day.replace('|', 'ـ'.repeat(n));
        n++;
      } while (el.getBoundingClientRect().width < target && n < 40);
    }, [day, ink, W - 60]);
    await page.locator('#t').screenshot({ path: join(OUT, `weekday-${i}-${mode}.png`), omitBackground: true });
  }
}
await browser.close();
console.log(`[widgets] wrote ${DAYS.length * 2} weekday images to assets/widgets`);
