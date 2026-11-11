// Captures the gallery's ?render mode with Playwright.
//   node render.js stills <outDir> 1.0 4.6 ...        → PNG stills at those times (s)
//   node render.js film <outDir> [fps=60] [from to]   → numbered frames for ffmpeg
//   PAGE=medad-gallery.html node render.js …          → capture another build of the page
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

(async () => {
  const [mode, outDir, ...rest] = process.argv.slice(2);
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(m.text()));
  await page.goto('file://' + path.join(__dirname, process.env.PAGE || 'index.html') + '?render');
  await page.evaluate(() => window.ready);
  console.log('cards', await page.evaluate(() => window.CARD_COUNT));
  const shot = async (t, file) => {
    const t0 = Date.now();
    await page.evaluate((x) => window.seek(x), t);
    await page.screenshot(file.endsWith('.png') ? { path: file, type: 'png' } : { path: file, type: 'jpeg', quality: 96 });
    return Date.now() - t0;
  };
  if (mode === 'stills') {
    for (const t of rest.map(Number)) console.log(t, await shot(t, path.join(outDir, `g${t.toFixed(2).padStart(5, '0')}.png`)), 'ms');
  } else {
    const fps = Number(rest[0] || 60);
    const total = Math.round(20 * fps);
    const from = Number(rest[1] || 0), to = Number(rest[2] || total);
    const start = Date.now();
    for (let f = from; f < to; f++) {
      await shot(f / fps, path.join(outDir, `f${String(f).padStart(5, '0')}.jpg`));
      if (f % 30 === 0) console.log(`frame ${f}/${total}  ${((Date.now() - start) / (f - from + 1)).toFixed(0)} ms/frame`);
    }
  }
  if (errors.length) console.log('page messages:\n' + [...new Set(errors)].slice(0, 20).join('\n'));
  await browser.close();
})();
