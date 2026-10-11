import json, re
import numpy as np, soundfile as sf
from scipy.signal import resample_poly
from faster_whisper import WhisperModel
m = WhisperModel('small.en', device='cpu', compute_type='int8', cpu_threads=1)
norm = lambda s: re.sub(r'[^a-z ]', '', s.lower().replace("'", '')).split()
ok = 0
for L in json.load(open('audio/vo/lines.json')):
    a, sr = sf.read(f"audio/vo/L{L['n']:02d}.wav", dtype='float32')
    a = resample_poly(a, 1, 3).astype(np.float32)   # 48 kHz -> 16 kHz
    segs, _ = m.transcribe(a, language='en', beam_size=5)
    hyp = ' '.join(s.text.strip() for s in segs)
    same = norm(hyp) == norm(L['text'])
    ok += same
    print(f"L{L['n']:02d} {'OK ' if same else 'DIFF'} | {hyp}")
print(f'{ok}/11 lines transcribed exactly as scripted')
