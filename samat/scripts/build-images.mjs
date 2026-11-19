// Builds the optimized imagery in public/ from the generated source PNGs.
//   node scripts/build-images.mjs <source-dir>
// Layers: alpha haze removed → trimmed to content → resized → WebP. Sauce colour variants are
// produced by re-tinting a neutral sauce photo. Icons are rendered from the original logo vectors.
import sharp from 'sharp';
import { mkdir, readFile, access } from 'node:fs/promises';
import path from 'node:path';

const SRC = process.argv[2];
if (!SRC) throw new Error('usage: node scripts/build-images.mjs <source-dir>');
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PUB = path.join(ROOT, 'public');

const exists = (p) => access(p).then(() => true, () => false);

async function cleanAlpha(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 3; i < data.length; i += 4) if (data[i] < 14) data[i] = 0;
  return sharp(data, { raw: info });
}

async function layer(srcName, out, width) {
  const file = path.join(SRC, `${srcName}.png`);
  if (!(await exists(file))) return console.warn('missing', srcName);
  const img = await cleanAlpha(file);
  const trimmed = await img.png().toBuffer().then((b) => sharp(b).trim({ threshold: 1 }).toBuffer());
  const dest = path.join(PUB, out);
  await mkdir(path.dirname(dest), { recursive: true });
  const meta = await sharp(trimmed).resize({ width, withoutEnlargement: true }).webp({ quality: 82, alphaQuality: 90, effort: 6 }).toFile(dest);
  console.log(out, `${meta.width}x${meta.height}`, `${(meta.size / 1024).toFixed(0)}KB`, `aspect=${(meta.height / meta.width).toFixed(3)}`);
}

/** Re-tint a pale sauce photo to another sauce colour, keeping its gloss and texture. */
async function tinted(srcName, out, hex, width) {
  const file = path.join(SRC, `${srcName}.png`);
  if (!(await exists(file))) return console.warn('missing', srcName);
  const { data, info } = await (await cleanAlpha(file)).raw().toBuffer({ resolveWithObject: true });
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  for (let i = 0; i < data.length; i += 4) {
    if (!data[i + 3]) continue;
    const l = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
    const shade = 0.3 + 0.75 * l;
    const spec = Math.max(0, (l - 0.9) / 0.1) * 0.55; // keep highlights
    for (let k = 0; k < 3; k++) data[i + k] = Math.min(255, Math.round(c[k] * shade * (1 - spec) + 255 * spec));
  }
  const buf = await sharp(data, { raw: info }).png().toBuffer();
  const trimmed = await sharp(buf).trim({ threshold: 1 }).toBuffer();
  const dest = path.join(PUB, out);
  await mkdir(path.dirname(dest), { recursive: true });
  const meta = await sharp(trimmed).resize({ width, withoutEnlargement: true }).webp({ quality: 82, alphaQuality: 90 }).toFile(dest);
  console.log(out, `${meta.width}x${meta.height}`, `${(meta.size / 1024).toFixed(0)}KB`);
}

async function photo(srcName, out, width, opts = {}) {
  const file = path.join(SRC, `${srcName}.png`);
  if (!(await exists(file))) return console.warn('missing', srcName);
  const dest = path.join(PUB, out);
  await mkdir(path.dirname(dest), { recursive: true });
  let s = sharp(file).resize({ width, height: opts.height, fit: 'cover', position: opts.position ?? 'centre', withoutEnlargement: true });
  s = out.endsWith('.jpg') ? s.jpeg({ quality: 80, mozjpeg: true }) : s.webp({ quality: 82, alphaQuality: 90 });
  const meta = await s.toFile(dest);
  console.log(out, `${meta.width}x${meta.height}`, `${(meta.size / 1024).toFixed(0)}KB`);
}

async function icons() {
  const icon = (await readFile(path.join(PUB, 'brand/samat-icon.svg'), 'utf8'));
  const full = (await readFile(path.join(PUB, 'brand/samat-logo.svg'), 'utf8'));
  const ESP = '#2F231C', CREAM = '#F2EEE3';
  const mark = (color) => Buffer.from(icon.replace('currentColor', color));
  await mkdir(path.join(PUB, 'icons'), { recursive: true });
  const square = async (size, scale, bg, fg, out) => {
    const inner = Math.round(size * scale);
    const m = await sharp(mark(fg), { density: 600 }).resize({ height: inner, width: inner, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    await sharp({ create: { width: size, height: size, channels: 4, background: bg } }).composite([{ input: m, gravity: 'centre' }]).png().toFile(path.join(PUB, out));
    console.log(out);
  };
  await square(192, 0.62, ESP, CREAM, 'icons/icon-192.png');
  await square(512, 0.62, ESP, CREAM, 'icons/icon-512.png');
  await square(512, 0.46, ESP, CREAM, 'icons/maskable-512.png');
  await square(180, 0.6, ESP, CREAM, 'icons/apple-touch-icon.png');
  await square(48, 0.7, ESP, CREAM, 'favicon.png');
  await sharp(Buffer.from(full.replace('currentColor', '#F7F3EA')), { density: 400 }).resize({ width: 280 }).png().toFile(path.join(PUB, 'brand/samat-logo-cream.png'));
  await sharp(Buffer.from(full.replace('currentColor', ESP)), { density: 400 }).resize({ width: 280 }).png().toFile(path.join(PUB, 'brand/samat-logo-ink.png'));
  console.log('brand pngs');
}

// ------------------------------------------------------------------------------- burger (side)
await layer('bun_top', 'media/layers/burger/bun-top.webp', 900);
await layer('bun_bottom', 'media/layers/burger/bun-bottom.webp', 900);
await layer('beef_patty', 'media/layers/burger/beef-patty.webp', 860);
await layer('chicken_crispy', 'media/layers/burger/crispy-chicken.webp', 860);
await layer('cheese', 'media/layers/burger/cheddar.webp', 880);
await layer('lettuce', 'media/layers/burger/lettuce.webp', 900);
await layer('tomato', 'media/layers/burger/tomato.webp', 860);
await layer('onion', 'media/layers/burger/red-onion.webp', 860);
await layer('caramelized_onion', 'media/layers/burger/caramelized-onion.webp', 860);
await layer('pickles', 'media/layers/burger/pickles.webp', 860);
await layer('jalapeno', 'media/layers/burger/jalapeno.webp', 860);
await layer('mushrooms', 'media/layers/burger/mushrooms.webp', 860);
await layer('sauce_white', 'media/layers/burger/sauce-garlic.webp', 860);
await tinted('sauce_white', 'media/layers/burger/sauce-special.webp', '#E58F55', 860);
await tinted('sauce_white', 'media/layers/burger/sauce-bbq.webp', '#5C2814', 860);
await tinted('sauce_white', 'media/layers/burger/sauce-spicy.webp', '#C42F1A', 860);
await tinted('sauce_white', 'media/layers/burger/sauce-tahini.webp', '#D9C197', 860);

// ---------------------------------------------------------------------------- shawarma (top)
await layer('s_bread_regular', 'media/layers/shawarma/bread-regular.webp', 1000);
await layer('s_bread_white', 'media/layers/shawarma/bread-white.webp', 1000);
await layer('s_chicken', 'media/layers/shawarma/chicken.webp', 800);
await layer('s_beef', 'media/layers/shawarma/beef.webp', 800);
await layer('s_pickles', 'media/layers/shawarma/pickles.webp', 760);
await layer('s_fries', 'media/layers/shawarma/fries.webp', 760);
await layer('s_tomato', 'media/layers/shawarma/tomato.webp', 760);
await layer('s_lettuce', 'media/layers/shawarma/lettuce.webp', 760);
await layer('s_onion_parsley', 'media/layers/shawarma/onion-parsley.webp', 760);
await layer('s_garlic', 'media/layers/shawarma/sauce-garlic.webp', 800);
await layer('s_tahini', 'media/layers/shawarma/sauce-tahini.webp', 800);
await layer('s_spicy', 'media/layers/shawarma/sauce-spicy.webp', 800);
await tinted('s_garlic', 'media/layers/shawarma/sauce-special.webp', '#E58F55', 800);
await tinted('s_garlic', 'media/layers/shawarma/sauce-bbq.webp', '#5C2814', 800);

// ------------------------------------------------------------------------- sauce thumbnails
await layer('s_garlic', 'media/sauces/garlic.webp', 320);
await tinted('s_garlic', 'media/sauces/special.webp', '#E58F55', 320);
await tinted('s_garlic', 'media/sauces/bbq.webp', '#5C2814', 320);
await layer('s_spicy', 'media/sauces/spicy.webp', 320);
await layer('s_tahini', 'media/sauces/tahini.webp', 320);

// ---------------------------------------------------------------------- products & hero shots
await layer('p_burger', 'media/products/burger.webp', 900);
await layer('p_shawarma', 'media/products/shawarma.webp', 900);
await layer('p_fries', 'media/products/fries.webp', 900);
await photo('hero', 'media/hero.jpg', 2400);
await photo('hero', 'media/og.jpg', 1200, { height: 630, position: 'right' });

await icons();
