// Writes public/privacy.html and public/terms.html from src/content/legal.ts, so the pages the
// app stores link to always match the in-app text. Run before `expo export --platform web`.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PRIVACY, TERMS } from '../src/content/legal.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const extra = JSON.parse(readFileSync(join(ROOT, 'app.json'), 'utf8')).expo.extra ?? {};
const email = (extra.supportEmail ?? '').trim();

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function section(doc, lang) {
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const parts = doc.sections
    .map((s) => `<h2>${esc(s.heading[lang])}</h2>\n${s.paragraphs.map((p) => `<p>${esc(p[lang])}</p>`).join('\n')}`)
    .join('\n');
  const contact = email
    ? `<h2>${lang === 'ar' ? 'التواصل' : 'Contact'}</h2><p><a href="mailto:${esc(email)}">${esc(email)}</a></p>`
    : '';
  return `<section lang="${lang}" dir="${dir}" id="${lang}">
<h1>${esc(doc.title[lang])}</h1>
<p class="date">${esc(doc.updated[lang])}</p>
${parts}
${contact}
</section>`;
}

function page(doc, other) {
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(doc.title.ar)} — مع الله | ${esc(doc.title.en)} — Ma Allah</title>
<meta name="description" content="${esc(doc.title.en)} for the Ma Allah app.">
<style>
  :root { --bg: #FBFAF5; --surface: #FFFFFF; --ink: #1F2A1C; --muted: #5F6A5B; --accent: #2F4529; --line: #E6E2D6; }
  @media (prefers-color-scheme: dark) { :root { --bg: #0F130E; --surface: #182017; --ink: #ECEFE6; --muted: #A8B2A3; --accent: #D5E4CC; --line: #2A3527; } }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--ink); font: 16px/1.85 -apple-system, "SF Arabic", "Segoe UI", Tahoma, "Noto Naskh Arabic", sans-serif; }
  main { max-width: 760px; margin: 0 auto; padding: 24px 16px 64px; }
  header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
  header strong { color: var(--accent); font-size: 20px; }
  nav a { color: var(--accent); margin-inline-start: 14px; font-size: 14px; }
  section { background: var(--surface); border: 1px solid var(--line); border-radius: 20px; padding: 20px 22px; margin-top: 18px; }
  h1 { color: var(--accent); font-size: 26px; margin: 0 0 4px; }
  h2 { color: var(--accent); font-size: 18px; margin: 22px 0 6px; }
  p { margin: 0 0 10px; color: var(--muted); }
  .date { font-size: 14px; }
  a { color: var(--accent); }
  footer { text-align: center; color: var(--muted); font-size: 13px; margin-top: 28px; }
</style>
</head>
<body>
<main>
<header>
  <strong>مع الله</strong>
  <nav><a href="#ar">العربية</a><a href="#en">English</a><a href="/${other.id}">${esc(other.title.ar)}</a></nav>
</header>
${section(doc, 'ar')}
${section(doc, 'en')}
<footer>مع الله · Ma Allah</footer>
</main>
</body>
</html>
`;
}

mkdirSync(join(ROOT, 'public'), { recursive: true });
writeFileSync(join(ROOT, 'public/privacy.html'), page(PRIVACY, TERMS));
writeFileSync(join(ROOT, 'public/terms.html'), page(TERMS, PRIVACY));
console.log(`[legal] wrote public/privacy.html and public/terms.html${email ? '' : ' (no support email set in app.json extra.supportEmail)'}`);
