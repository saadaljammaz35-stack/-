// Render film.html frame by frame. One screenshot per 59.94 fps master frame.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const args = process.argv.slice(2);
const vert = args.includes('--vert');          // 9:16, 1080x1920
const outDir = args.find(a => !a.startsWith('--') && isNaN(Number(a))) || path.join(HERE, 'frames');
// frame list: either explicit 29.97 frame numbers, or the whole master
const explicit = args.filter(a => !a.startsWith('--') && !isNaN(Number(a)) && a !== '').map(Number);

fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ args: ['--force-color-profile=srgb', '--font-render-hinting=none'] });
const page = await browser.newPage({ viewport: { width: 1080, height: vert ? 1920 : 1080 }, deviceScaleFactor: 1 });
const errs = [];
page.on('pageerror', e => errs.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
await page.goto('file://' + path.join(HERE, 'film.html'));
await page.waitForFunction('window.filmReady !== undefined');
await page.evaluate(() => window.filmReady);
await page.evaluate(v => window.setFormat(v ? 'vert' : 'square'), vert);
if (errs.length) { console.error(errs.join('\n')); }

const t0 = Date.now();
if (explicit.length) {
  for (const f of explicit) {
    await page.evaluate(f => window.seek(f), f);
    await page.screenshot({ path: path.join(outDir, 'f' + String(f).padStart(4, '0') + '.png') });
    console.log('still f' + f);
  }
} else {
  const N = 720;                       // 59.94 fps master, 12.012 s
  for (let m = 0; m < N; m++) {
    await page.evaluate(m => window.seek(m / 2), m);
    await page.screenshot({ path: path.join(outDir, String(m).padStart(4, '0') + '.png') });
    if (m % 60 === 0) process.stdout.write(`\r${m}/${N}  ${((Date.now() - t0) / 1000).toFixed(0)}s   `);
  }
  process.stdout.write(`\r${N}/${N}  ${((Date.now() - t0) / 1000).toFixed(0)}s\n`);
}
if (errs.length) console.error('PAGE ERRORS:\n' + errs.slice(0, 20).join('\n'));
await browser.close();
