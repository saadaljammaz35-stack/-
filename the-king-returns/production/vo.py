import numpy as np, soundfile as sf, subprocess, json
from kokoro_onnx import Kokoro
from scipy import signal
k = Kokoro('models/kokoro-v1.0.onnx', 'models/voices-v1.0.bin')
LINES = [  # start, end (subtitle window), text
    (7.0, 10.0, 'Every story has a silence.'),
    (13.0, 17.0, 'Mine lasted longer than I planned.'),
    (18.5, 22.5, 'The lights went out. The room went quiet.'),
    (26.0, 30.0, 'But I never forgot where it started.'),
    (31.5, 36.5, 'Every video. Every late night. Every person who stayed.'),
    (41.0, 45.0, "Time away doesn't end the journey."),
    (46.5, 51.0, "Sometimes, it's where you learn who you are."),
    (56.0, 60.0, "Coming back isn't an announcement."),
    (61.0, 64.0, "It's a decision."),
    (70.0, 73.5, "And I've made mine."),
    (76.0, 80.5, 'A new chapter starts now.'),
]
SR = 48000

def trim(a, sr, db=-42):
    env = np.abs(a)
    th = 10 ** (db / 20) * env.max()
    idx = np.where(env > th)[0]
    a = a[max(idx[0] - int(0.02 * sr), 0): idx[-1] + int(0.12 * sr)]
    return a

info = []
for i, (s, e, text) in enumerate(LINES, 1):
    win = e - s - 0.2
    speed = 0.80
    while True:
        a, sr = k.create(text, voice='am_michael', speed=speed, lang='en-us')
        a = trim(a.astype(np.float32), sr)
        d = len(a) / sr / 1.0   # rubberband pitch shift keeps duration
        if d <= win or speed >= 1.05:
            break
        speed += 0.04
    raw = f'audio/vo/L{i:02d}_raw.wav'
    sf.write(raw, a, sr)
    out = f'audio/vo/L{i:02d}.wav'
    chain = ('aresample=48000:resampler=soxr,'
             'rubberband=pitch=0.917:formant=preserved:pitchq=quality:transients=smooth,'
             'highpass=f=70:poles=2,'
             'equalizer=f=160:t=q:w=0.9:g=2.5,equalizer=f=3400:t=q:w=1.2:g=1.5,equalizer=f=7200:t=q:w=1.5:g=-1.5,'
             'acompressor=threshold=-20dB:ratio=3:attack=5:release=120:makeup=2')
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', raw, '-af', chain, '-ar', '48000', '-ac', '1', out], check=True)
    b, _ = sf.read(out)
    info.append(dict(n=i, start=s, end=e, text=text, speed=round(speed, 2), dur=round(len(b) / SR, 2), window=e - s))
    print(f'L{i:02d} speed {speed:.2f}  dur {len(b)/SR:.2f}s  window {e-s:.1f}s  {text}')
json.dump(info, open('audio/vo/lines.json', 'w'), indent=1)
