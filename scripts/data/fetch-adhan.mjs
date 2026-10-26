// Produces the adhan notification sounds from a public-domain (CC0) recording.
// iOS plays at most 30 seconds of a notification sound, so the clips end at the natural pause
// after a phrase: the adhan clip after the second «أشهد أن لا إله إلا الله», the takbir clip
// after the opening takbirs. The generated files are committed (EAS builds have no ffmpeg).
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { ROOT, assert, fetchBuffer, log, sha256, writeJson } from './lib.mjs';
import { writeFileSync } from 'node:fs';

const SOURCE = {
  title: 'ICR Friday Prayer 2nd Adhan, 17 May 2024 (9 Dhul-Qadah 1445)',
  muezzin: 'Asim Javed',
  license: 'CC0 1.0 (public domain dedication)',
  page: 'https://archive.org/details/icr-friday-prayer-2nd-adhan-17th-may-2024-9th-dhul-qadah-1445-by-asim-javed',
  url: 'https://archive.org/download/icr-friday-prayer-2nd-adhan-17th-may-2024-9th-dhul-qadah-1445-by-asim-javed/ICR_Friday_Prayer_2nd_Adhan_17th_May_2024_9th_Dhul_Qadah_1445_by_Asim_Javed.wav',
  sha256: '04148fbfabf36e4c05039510b058578e181f1428cb1236eb478a7c89aed65e3e',
};

// End points sit in the low-energy pauses between phrases (checked on the loudness envelope).
const CLIPS = [
  { file: 'adhan.wav', seconds: 24.3, content: 'الله أكبر ×٤، أشهد أن لا إله إلا الله ×٢' },
  { file: 'takbir.wav', seconds: 11.9, content: 'الله أكبر ×٤' },
];

async function main() {
  const wav = await fetchBuffer(SOURCE.url);
  assert(sha256(wav) === SOURCE.sha256, 'adhan source checksum changed');
  const input = join(ROOT, '.data-cache', 'adhan-source.wav');
  writeFileSync(input, wav);
  for (const clip of CLIPS) {
    assert(clip.seconds < 30, 'iOS notification sounds must be shorter than 30 seconds');
    const fadeAt = (clip.seconds - 0.4).toFixed(2);
    execFileSync('ffmpeg', [
      '-hide_banner', '-v', 'error', '-y', '-i', input, '-t', String(clip.seconds),
      '-af', `afade=t=in:st=0:d=0.05,afade=t=out:st=${fadeAt}:d=0.4,loudnorm=I=-16:TP=-1.5:LRA=11`,
      '-ac', '1', '-ar', '22050', '-c:a', 'pcm_s16le', join(ROOT, 'assets/sounds', clip.file),
    ]);
    log(`adhan: wrote assets/sounds/${clip.file} (${clip.seconds}s)`);
  }
  writeJson('audio/adhan.json', { source: SOURCE, clips: CLIPS });
}

main();
