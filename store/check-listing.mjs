// Checks store/listing.md against the Google Play and App Store length limits.
import { readFileSync } from 'node:fs';

const text = readFileSync(new URL('./listing.md', import.meta.url), 'utf8');
let failed = 0;
const check = (label, value, limit) => {
  const n = [...value.trim()].length;
  const ok = n <= limit;
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${String(n).padStart(4)}/${limit} ${label}`);
};
for (const lang of text.split(/^## /m).slice(1, 3)) {
  const name = lang.split('\n')[0];
  for (const m of lang.matchAll(/^- (.+?) \((\d+)\): (.+)$/gm)) check(`${name} · ${m[1]}`, m[3], Number(m[2]));
  for (const m of lang.matchAll(/^### (.+?) \((\d+)\)\n([\s\S]*?)(?=\n### |\n## |(?![\s\S]))/gm)) check(`${name} · ${m[1]}`, m[3], Number(m[2]));
}
process.exit(failed ? 1 : 0);
