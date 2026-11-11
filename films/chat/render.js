// Renders index.html with Playwright, every frame from seek(t).
//   node render.js stills <outDir> 1.8 6.2 9.0 13.9     → PNG stills at those times (s)
//   node render.js film <outDir> [sub=8] [from to]       → 60 fps frames × sub-frames for tmix motion blur
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

(async () => {
  const [mode, outDir, ...rest] = process.argv.slice(2);
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('file://' + path.join(__dirname, 'index.html'));
  await page.evaluate(() => window.ready);
  const duration = await page.evaluate(() => window.DURATION);
  const stage = await page.$('#stage');
  const shot = async (t, name) => {
    await page.evaluate((x) => window.seek(x), t);
    await stage.screenshot({ path: path.join(outDir, name) });
  };
  if (mode === 'stills') {
    for (const t of rest.map(Number)) await shot(t, `t${t.toFixed(2).padStart(5, '0')}.png`);
  } else {
    const sub = Number(rest[0] || 8);
    const total = Math.round(duration * 60);
    const from = Number(rest[1] || 0), to = Number(rest[2] || total);
    for (let f = from; f < to; f++) {
      for (let s = 0; s < sub; s++) {
        // sub-frames spread across a 180° shutter, centred on the frame time
        const t = Math.min(duration - 1e-4, Math.max(0, (f + (s + 0.5) / sub * 0.5 - 0.25) / 60));
        await shot(t, `s${String(f * sub + s).padStart(5, '0')}.png`);
      }
      if (f % 60 === 0) console.log(`frame ${f}/${total}`);
    }
  }
  if (errors.length) console.log('page errors:\n' + [...new Set(errors)].join('\n'));
  await browser.close();
})();
