// MAHALLAK brand asset generator.
// Builds the vector mark, the full lockups (Arabic text converted to outlines with
// HarfBuzz so the SVGs render identically everywhere), and every raster the app needs:
// iOS icon, Android adaptive layers, splash, favicon and PNG logo exports.
//
// Run:  cd tools/brand && npm install && node generate.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import * as hb from 'harfbuzzjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const out = (...p) => path.join(root, ...p);
const fontDir = out('node_modules', '@expo-google-fonts', 'ibm-plex-sans-arabic');

const C = {
  emerald: '#12392F',
  forest: '#0B2923',
  beige: '#F1E8D8',
  ivory: '#FFFDF7',
  gold: '#C5A66A',
  goldLight: '#E4D0A0',
  goldDeep: '#A8884E',
};

// ---------------------------------------------------------------------------
// The mark: a location pin over an "M" folded like a roof, with a 4-pane window.
// Drawn on a 200x200 grid. `paint` decides gradient ids or flat colors.
// ---------------------------------------------------------------------------
function markGroup({ legs, folds, foldsAlt, pin, windowFill, cut }) {
  return `
  <g>
    <!-- legs (ribbon ends cut on a bias) -->
    <path d="M30 66 H52 V140 L30 154 Z" fill="${legs}"/>
    <path d="M170 66 H148 V140 L170 154 Z" fill="${legs}"/>
    <!-- folds: the two ribbons meeting in a V like a roof line -->
    <path d="M30 70 C30 58 41 51 51 57 L103 96 L96 118 L33 72 Z" fill="${folds}"/>
    <path d="M170 70 C170 58 159 51 149 57 L97 96 L104 118 L167 72 Z" fill="${foldsAlt}"/>
    <path d="M103 96 L96 118 L99 119 L105 100 Z" fill="${cut}" opacity="0.18"/>
    <!-- pin -->
    <path fill-rule="evenodd" fill="${pin}" d="M100 80 C93 70 86 61 86 50 A14 14 0 0 1 114 50 C114 61 107 70 100 80 Z M100 44 A6 6 0 1 0 100 56 A6 6 0 1 0 100 44 Z"/>
    <!-- window -->
    <g fill="${windowFill}">
      <rect x="91" y="129" width="7.5" height="7.5" rx="1.2"/>
      <rect x="101.5" y="129" width="7.5" height="7.5" rx="1.2"/>
      <rect x="91" y="139.5" width="7.5" height="7.5" rx="1.2"/>
      <rect x="101.5" y="139.5" width="7.5" height="7.5" rx="1.2"/>
    </g>
  </g>`;
}

const goldDefs = `
  <linearGradient id="gLegs" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${C.gold}"/>
    <stop offset="1" stop-color="${C.goldDeep}"/>
  </linearGradient>
  <linearGradient id="gFold" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${C.goldLight}"/>
    <stop offset="1" stop-color="${C.gold}"/>
  </linearGradient>
  <linearGradient id="gFoldAlt" x1="1" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#EAD9AE"/>
    <stop offset="1" stop-color="#CDB077"/>
  </linearGradient>`;

const goldMark = markGroup({
  legs: 'url(#gLegs)',
  folds: 'url(#gFold)',
  foldsAlt: 'url(#gFoldAlt)',
  pin: 'url(#gFold)',
  windowFill: 'url(#gFold)',
  cut: C.forest,
});

const flatMark = (color, cut = '#000') =>
  markGroup({ legs: color, folds: color, foldsAlt: color, pin: color, windowFill: color, cut });

// ---------------------------------------------------------------------------
// Text to outlines (HarfBuzz shaping => correct Arabic joining and diacritics)
// ---------------------------------------------------------------------------
function loadFont(file) {
  const data = fs.readFileSync(path.join(fontDir, file));
  const blob = new hb.Blob(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
  const face = new hb.Face(blob, 0);
  const font = new hb.Font(face);
  return { face, font, upem: face.upem };
}

function shapeToPath(fontObj, text, { size, letterSpacing = 0 }) {
  const { font, upem } = fontObj;
  const buffer = new hb.Buffer();
  buffer.addText(text);
  buffer.guessSegmentProperties();
  hb.shape(font, buffer);
  const infos = buffer.getGlyphInfos();
  const positions = buffer.getGlyphPositions();
  const scale = size / upem;
  let x = 0;
  const parts = [];
  infos.forEach((info, i) => {
    const pos = positions[i];
    const d = font.glyphToPath(info.codepoint);
    if (d) {
      // glyph space is y-up; flip it
      parts.push(
        `<path transform="translate(${((x + pos.xOffset) * scale).toFixed(2)} ${(-pos.yOffset * scale).toFixed(2)}) scale(${scale.toFixed(5)} ${(-scale).toFixed(5)})" d="${d}"/>`,
      );
    }
    x += pos.xAdvance + (letterSpacing / scale);
  });
  const width = x * scale - letterSpacing;
  return { svg: parts.join(''), width };
}

const fBold = loadFont('700Bold/IBMPlexSansArabic_700Bold.ttf');
const fMedium = loadFont('500Medium/IBMPlexSansArabic_500Medium.ttf');
const fRegular = loadFont('400Regular/IBMPlexSansArabic_400Regular.ttf');

function lockup({ width = 600, height = 760, textColor, subColor, background, mark }) {
  const word = shapeToPath(fBold, 'مَحَلّك', { size: 128 });
  const latin = shapeToPath(fMedium, 'MAHALLAK', { size: 34, letterSpacing: 16 });
  const tag = shapeToPath(fRegular, 'كل شيء له مكان.', { size: 30 });
  const cx = width / 2;
  const bg = background
    ? `<rect width="${width}" height="${height}" rx="0" fill="${background}"/>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>${goldDefs}</defs>
  ${bg}
  <g transform="translate(${cx - 150} 10) scale(1.5)">${mark}</g>
  <g fill="${textColor}" transform="translate(${cx - word.width / 2} 470)">${word.svg}</g>
  <g fill="${textColor}" transform="translate(${cx - latin.width / 2} 560)">${latin.svg}</g>
  <g fill="${subColor}">
    <rect x="${cx - tag.width / 2 - 92}" y="628" width="60" height="2" rx="1"/>
    <rect x="${cx + tag.width / 2 + 32}" y="628" width="60" height="2" rx="1"/>
  </g>
  <g fill="${subColor}" transform="translate(${cx - tag.width / 2} 640)">${tag.svg}</g>
</svg>`;
}

function markSvg(inner, { size = 200, background, pad = 0 } = {}) {
  const vb = 200 + pad * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${vb} ${vb}" width="${size}" height="${size}">
  <defs>${goldDefs}</defs>
  ${background ?? ''}
  ${inner}
</svg>`;
}

// Opaque app icon: emerald depth + soft ambient light + gold mark.
function iconSvg(size = 1024) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="${size}" height="${size}">
  <defs>
    ${goldDefs}
    <radialGradient id="bg" cx="0.3" cy="0.2" r="1.05">
      <stop offset="0" stop-color="#1D5546"/>
      <stop offset="0.55" stop-color="${C.emerald}"/>
      <stop offset="1" stop-color="${C.forest}"/>
    </radialGradient>
    <radialGradient id="glow" cx="0.5" cy="0.45" r="0.5">
      <stop offset="0" stop-color="${C.gold}" stop-opacity="0.18"/>
      <stop offset="1" stop-color="${C.gold}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <rect width="1024" height="1024" fill="url(#glow)"/>
  <g transform="translate(192 176) scale(3.2)">${goldMark}</g>
</svg>`;
}

const androidBg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs><radialGradient id="bg" cx="0.3" cy="0.2" r="1.05">
    <stop offset="0" stop-color="#1D5546"/><stop offset="0.55" stop-color="${C.emerald}"/><stop offset="1" stop-color="${C.forest}"/>
  </radialGradient></defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>
</svg>`;

// Adaptive icon foreground: keep the mark inside the 66% safe zone.
const androidFg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>${goldDefs}</defs>
  <g transform="translate(287 272) scale(2.25)">${goldMark}</g>
</svg>`;
const androidMono = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <g transform="translate(287 272) scale(2.25)">${flatMark('#FFFFFF', '#000000')}</g>
</svg>`;

async function png(svg, file, size) {
  const target = out(file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  let img = sharp(Buffer.from(svg), { density: 300 });
  if (size) img = img.resize(size, size);
  await img.png({ compressionLevel: 9 }).toFile(target);
  console.log('png ', file);
}
function write(file, content) {
  const target = out(file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
  console.log('svg ', file);
}

// --- vectors ---------------------------------------------------------------
const markGold = markSvg(goldMark, { size: 512 });
const markEmerald = markSvg(flatMark(C.emerald, C.ivory), { size: 512 });
const fullDark = lockup({ textColor: C.beige, subColor: C.gold, background: C.emerald, mark: goldMark });
const fullTransparentGold = lockup({ textColor: C.beige, subColor: C.gold, mark: goldMark });
const fullLight = lockup({
  textColor: C.emerald,
  subColor: C.goldDeep,
  background: C.ivory,
  mark: flatMark(C.emerald, C.ivory),
});

write('assets/brand/logo-mark-gold.svg', markGold);
write('assets/brand/logo-mark-emerald.svg', markEmerald);
write('assets/brand/logo-full-dark.svg', fullDark);
write('assets/brand/logo-full-gold-transparent.svg', fullTransparentGold);
write('assets/brand/logo-full-light.svg', fullLight);
write('assets/brand/app-icon.svg', iconSvg());

// --- rasters ---------------------------------------------------------------
await png(markGold, 'assets/brand/logo-mark-gold-1024.png', 1024);
await png(markEmerald, 'assets/brand/logo-mark-emerald-1024.png', 1024);
await png(fullDark, 'assets/brand/logo-full-dark.png');
await png(fullLight, 'assets/brand/logo-full-light.png');
await png(fullTransparentGold, 'assets/brand/logo-full-gold-transparent.png');

await png(iconSvg(), 'assets/images/icon.png', 1024);
await png(androidBg, 'assets/images/android-icon-background.png', 1024);
await png(androidFg, 'assets/images/android-icon-foreground.png', 1024);
await png(androidMono, 'assets/images/android-icon-monochrome.png', 1024);
await png(markSvg(goldMark, { pad: 10 }), 'assets/images/splash-icon.png', 1024);
await png(iconSvg(), 'assets/images/favicon.png', 96);

// iOS 26 Icon Composer bundle: background fill + mark layer (Liquid Glass aware).
const iconDir = 'assets/mahallak.icon';
write(`${iconDir}/Assets/mark.svg`, markSvg(goldMark, { size: 1024, pad: 40 }));
write(
  `${iconDir}/icon.json`,
  JSON.stringify(
    {
      fill: { 'automatic-gradient': 'extended-srgb:0.07059,0.22353,0.18431,1.00000' },
      groups: [
        {
          layers: [{ 'image-name': 'mark.svg', name: 'mark', position: { scale: 1, 'translation-in-points': [0, 0] } }],
          shadow: { kind: 'neutral', opacity: 0.5 },
          translucency: { enabled: true, value: 0.4 },
        },
      ],
      'supported-platforms': { circles: ['watchOS'], squares: 'shared' },
    },
    null,
    2,
  ),
);
console.log('done');
