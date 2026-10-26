// Makes the adhan notification sounds from a recording supplied by the app's owner:
//   node scripts/data/make-adhan.mjs <recording (any format ffmpeg reads)>
// The cut points sit in the pauses between phrases, found on the loudness envelope.
// iOS plays at most 30 seconds of a notification sound, so iOS gets the four opening takbirs;
// Android plays the full adhan. The outputs are committed (EAS builds have no ffmpeg).
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

import { ROOT, assert, log, writeJson } from './lib.mjs';

const SOURCE = {
  description: 'Adhan recording supplied by the app owner (video carrying the «مزامير الفرقان» mark)',
  rights: 'Written permission from the rights holder is required before a store release.',
};

const START = 0.2; // the first 0.2 s are silence
const OUTPUTS = [
  // Android full adhan: Ogg Vorbis keeps the two-minute recording small.
  { file: 'adhan_full.ogg', from: START, to: null, content: 'الأذان كاملًا', codec: ['-c:a', 'libvorbis', '-q:a', '3'] },
  { file: 'adhan.wav', from: START, to: 24.5, content: 'الله أكبر ×٤', codec: ['-c:a', 'pcm_s16le'] },
  { file: 'takbir.wav', from: START, to: 10.95, content: 'الله أكبر ×٢', codec: ['-c:a', 'pcm_s16le'] },
];

const input = process.argv[2];
assert(input, 'usage: node scripts/data/make-adhan.mjs <recording>');
const duration = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', input]).toString());

for (const o of OUTPUTS) {
  const end = o.to ?? duration;
  const length = end - o.from;
  if (o.file.endsWith('.wav')) assert(length < 30, `${o.file}: iOS notification sounds must be shorter than 30 seconds`);
  const fadeAt = (length - 0.5).toFixed(2);
  execFileSync('ffmpeg', [
    '-hide_banner', '-v', 'error', '-y', '-ss', String(o.from), '-t', length.toFixed(2), '-i', input, '-vn',
    '-af', `afade=t=in:st=0:d=0.05,afade=t=out:st=${fadeAt}:d=0.5,loudnorm=I=-16:TP=-1.5:LRA=11`,
    '-ac', '1', '-ar', '22050', ...o.codec, join(ROOT, 'assets/sounds', o.file),
  ]);
  o.seconds = Number(length.toFixed(2));
  log(`adhan: wrote assets/sounds/${o.file} (${o.seconds}s)`);
}
writeJson('audio/adhan.json', { source: SOURCE, outputs: OUTPUTS.map(({ codec, ...o }) => o) });
