// Adds the home-screen icon, web app manifest and app title to the exported web page, so
// «Add to Home Screen» shows the app's icon and name and opens without the browser chrome.
// Run after `expo export --platform web`.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const file = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'index.html');
const html = readFileSync(file, 'utf8');
const MARK = '<!-- web-head -->';
if (html.includes(MARK)) process.exit(0);
const tags = [
  MARK,
  '<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
  '<link rel="manifest" href="/manifest.webmanifest">',
  '<meta name="apple-mobile-web-app-title" content="مع الله">',
  '<meta name="application-name" content="مع الله">',
  '<meta name="apple-mobile-web-app-capable" content="yes">',
  '<meta name="mobile-web-app-capable" content="yes">',
  '<meta name="apple-mobile-web-app-status-bar-style" content="default">',
  '<meta name="theme-color" content="#2F4529">',
].join('\n');
if (!html.includes('</head>')) throw new Error('web-head: no </head> in dist/index.html');
writeFileSync(file, html.replace('</head>', `${tags}\n</head>`));
console.log('[web-head] added icon, manifest and app title to dist/index.html');
