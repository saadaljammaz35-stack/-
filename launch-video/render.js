// Renders film.html frame by frame with Playwright.
//   node render.js stills <outDir> 40 86 150 230    → PNG stills of those frames
//   node render.js film <outDir>                    → 720 half-frames (59.94 fps master)
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

(async () => {
  const [mode, outDir, ...rest] = process.argv.slice(2);
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1080 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('file://' + path.join(__dirname, 'film.html'));
  await page.evaluate(() => window.ready);
  const stage = await page.$('#stage');

  const frames =
    mode === 'stills' ? rest.map(Number) : Array.from({ length: 720 }, (_, i) => i / 2);
  for (const [i, f] of frames.entries()) {
    await page.evaluate((fr) => window.seek(fr), f);
    const name = mode === 'stills' ? `f${String(f).padStart(3, '0')}.png` : `m${String(i).padStart(4, '0')}.png`;
    await stage.screenshot({ path: path.join(outDir, name) });
    if (mode !== 'stills' && i % 60 === 0) console.log(`frame ${i}/720`);
  }
  if (errors.length) console.log('page errors:\n' + errors.join('\n'));
  await browser.close();
})();
