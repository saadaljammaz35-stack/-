"""Cuts the voiceover take into its lines and lays them on the film's timeline.

    python vo_prep.py take.mp3 audio/vo.flac

The take (ElevenLabs via Higgsfield, voice "Marcus") reads the whole script
with pauses; each line is cut at those pauses, gently time-tightened where a
scene is short (pitch preserved via ffmpeg atempo) and placed on its shot.
"""
import os
import subprocess
import sys
import tempfile
import wave

import numpy as np

SR = 48000
DUR = 12.075

# (take start, take end, film start, tempo, text)
LINES = [
    (0.03, 1.95, 0.25, 1.00, 'تبي موقع يرفع الرّاس؟'),        # S1 header + click
    (2.25, 3.33, 4.40, 1.00, 'حنّا نرسمه لك،'),                 # S3 prompt finishing
    (3.66, 5.28, 5.62, 1.08, 'تفصيلة بتفصيلة.'),               # S4 key phrase
    (5.64, 6.44, 7.20, 1.12, 'تصميم…'),                        # S6 top card
    (6.50, 7.44, 7.96, 1.12, 'وتطوير.'),                       # S6 bottom card
    (7.55, 8.33, 8.98, 1.00, 'مِداد.'),                         # S7 disc hold
    (8.62, 10.88, 9.92, 1.10, 'نصنع حضوراً يُترك أثره.'),      # S8 end card
]


def read_wav(path):
    with wave.open(path) as w:
        return np.frombuffer(w.readframes(w.getnframes()), dtype='<i2').astype(float) / 32768


def ffmpeg(*args):
    subprocess.run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', *args], check=True)


def main(take, out):
    tmpdir = tempfile.mkdtemp()
    base = os.path.join(tmpdir, 'take.wav')
    ffmpeg('-i', take, '-ac', '1', '-ar', str(SR), base)
    track = np.zeros(int(round(DUR * SR)))
    for k, (a, b, at, tempo, _text) in enumerate(LINES):
        seg = os.path.join(tmpdir, f'l{k}.wav')
        fade = 0.03
        ffmpeg('-i', base, '-af',
               f'atrim={a}:{b},asetpts=PTS-STARTPTS,afade=t=in:d={fade},'
               f'areverse,afade=t=in:d={fade},areverse,atempo={tempo}', seg)
        x = read_wav(seg)
        i0 = int(round(at * SR))
        n = min(len(x), len(track) - i0)
        track[i0:i0 + n] += x[:n]
        print(f'line {k}: {at:.2f}–{at + len(x) / SR:.2f} s')
    pcm = (np.clip(track, -1, 1) * 32767).astype('<i2')
    wav = os.path.join(tmpdir, 'vo.wav')
    with wave.open(wav, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    ffmpeg('-i', wav, '-c:a', 'flac', out)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
