"""Soundtrack for the MEDAD gallery film (20 s), composed in code.

    python audio.py out.wav

A slow ambient bed in D (80 BPM feel) under sound that follows the shots:
- a focus tick on the rack
- the blue wave passing along the wall
- air on the crane
- a hinge and a heavy swing for the card, with the type lifting line by line
- pen on paper while the ink writes MEDAD
- a low bloom as the logo rises

Mastered to -14 LUFS integrated with a true-peak ceiling.
"""
import os
import re
import subprocess
import sys
import tempfile
import wave

import numpy as np

SR = 48000
DUR = 20.0
N = int(SR * DUR)
rng = np.random.default_rng(20261112)
fx = np.zeros((N, 2))
music = np.zeros((N, 2))
SHOT = [0, 3.2, 6.6, 10.0, 13.4, 17.4, 20.0]


def place(sig, t0, pan=0.0, gain=1.0, bus=None):
    if sig.ndim == 1:
        a = (pan + 1) * np.pi / 4
        sig = np.stack([sig * np.cos(a), sig * np.sin(a)], axis=1)
    i0 = int(round(t0 * SR))
    j0 = max(0, -i0)
    i0 = max(0, i0)
    n = min(len(sig) - j0, N - i0)
    if n > 0:
        (fx if bus is None else bus)[i0:i0 + n] += gain * sig[j0:j0 + n]


def band_noise(n, lo, hi):
    spec = np.fft.rfft(rng.standard_normal(n))
    f = np.fft.rfftfreq(n, 1 / SR)
    out = np.fft.irfft(spec / (1 + (lo / np.maximum(f, 1)) ** 4) / (1 + (f / hi) ** 4), n)
    return out / (np.abs(out).max() + 1e-9)


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def swell(t0, t1, lo, hi, gain, pan_from=-0.3, pan_to=0.3, shape=2.0):
    n = int((t1 - t0) * SR)
    t = np.arange(n) / SR
    u = t / t[-1]
    env = np.sin(np.pi * u) ** shape
    sig = band_noise(n, lo, hi) * env
    pans = np.linspace(pan_from, pan_to, n)
    a = (pans + 1) * np.pi / 4
    place(np.stack([sig * np.cos(a), sig * np.sin(a)], axis=1), t0, gain=gain)


def tick(t0, f=2600, gain=0.3, pan=0.0):
    n = int(0.08 * SR)
    t = np.arange(n) / SR
    sig = band_noise(n, 2500, 12000) * np.exp(-t / 0.003) * 0.7 + np.sin(2 * np.pi * f * t) * np.exp(-t / 0.012) * 0.4
    place(sig, t0, pan=pan, gain=gain)


def thud(t0, gain, f_hi=120, f_lo=45, decay=0.4):
    n = int(1.5 * SR)
    t = np.arange(n) / SR
    f = f_lo + (f_hi - f_lo) * np.exp(-t / 0.05)
    sig = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / decay) * np.minimum(1, t / 0.004)
    place(sig, t0, gain=gain)


def creak(t0, length, gain):
    # a hinge: a slowly gliding, rough friction tone
    n = int(length * SR)
    t = np.arange(n) / SR
    f = 380 + 160 * np.sin(np.pi * t / length) + 30 * np.sin(2 * np.pi * 3.1 * t)
    grains = (np.sin(2 * np.pi * 47 * t) > 0.2).astype(float) * 0.6 + 0.4
    sig = np.sin(2 * np.pi * np.cumsum(f) / SR) * grains
    sig += 0.5 * np.sin(2 * np.pi * np.cumsum(2.02 * f) / SR) * grains
    sig *= np.sin(np.pi * t / length) ** 1.5
    place(sig * 0.5 + band_noise(n, 900, 3000) * 0.2 * np.sin(np.pi * t / length), t0, pan=0.25, gain=gain)


def scratch(t0, t1, gain):
    # pen on paper: band noise in strokes, faster as the ink runs on
    n = int((t1 - t0) * SR)
    t = np.arange(n) / SR
    u = t / t[-1]
    rate = 5 + 7 * np.sin(np.pi * u)
    strokes = 0.5 + 0.5 * np.sin(2 * np.pi * np.cumsum(rate) / SR) ** 2
    env = np.sin(np.pi * u) ** 0.6
    sig = band_noise(n, 1800, 9000) * strokes * env + band_noise(n, 300, 1200) * 0.25 * env
    pans = -0.5 + u
    a = (pans + 1) * np.pi / 4
    place(np.stack([sig * np.cos(a), sig * np.sin(a)], axis=1), t0, gain=gain)


def chime(t0, m, gain, decay=1.2, pan=0.0):
    n = int(decay * 4 * SR)
    t = np.arange(n) / SR
    f = midi(m)
    sig = (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 2.76 * f * t) * np.exp(-t / (decay / 4)))
    sig *= np.exp(-t / decay) * np.minimum(1, t / 0.003)
    place(sig, t0, pan=pan, gain=gain, bus=music)


def pad(t0, t1, notes, gain, cutoff):
    n = int((t1 - t0) * SR)
    t = np.arange(n) / SR
    env = np.minimum(1, t / 1.2) * np.minimum(1, (t[-1] - t) / 1.0)
    L = np.zeros(n)
    R = np.zeros(n)
    for m in notes:
        for d, (wl, wr) in zip((-6, 0, 6), ((0.9, 0.3), (0.6, 0.6), (0.3, 0.9))):
            f = midi(m) * 2 ** (d / 1200)
            ph = rng.uniform(0, 2 * np.pi)
            v = sum(np.sin(2 * np.pi * f * h * t + ph * h) / (h * h) * np.exp(-f * h / cutoff) for h in range(1, 5))
            L += v * wl
            R += v * wr
    place(np.stack([L, R], axis=1) * env[:, None], t0, gain=gain, bus=music)


def effects():
    tick(0.9, 3100, 0.25, pan=0.3)                         # rack focus: the lens settles
    tick(2.2, 2400, 0.18, pan=0.1)
    swell(3.3, 6.2, 400, 5000, 0.45, -0.6, 0.6, 1.5)        # the wave runs along the wall
    for k in range(10):                                     # cards tipping as it passes
        tick(3.9 + k * 0.17, 1700 + 40 * k, 0.07, pan=-0.6 + 0.12 * k)
    swell(6.6, 10.0, 150, 2400, 0.5, 0.2, -0.2, 2.0)        # crane: air over the wall
    t0 = SHOT[3] + 0.55
    tick(t0, 1200, 0.4, pan=0.3)                            # the card pops loose
    creak(t0 + 0.1, 0.9, 0.22)                              # hinge
    thud(t0 + 0.95, 0.35, 160, 70, 0.18)                    # swing reaches its stop
    for i in range(3):                                      # type lifts, line by line
        swell(SHOT[3] + 1.5 + i * 0.36, SHOT[3] + 2.0 + i * 0.36, 2500, 9000, 0.12, 0.2, -0.1)
        tick(SHOT[3] + 1.62 + i * 0.36, 2900 + 200 * i, 0.12)
    swell(13.3, 17.2, 120, 3000, 0.55, -0.1, 0.1, 1.2)      # pull back
    scratch(13.65, 17.25, 0.32)                             # the ink writes MEDAD
    thud(17.65, 0.6, 110, 42, 0.7)                          # the logo rises
    swell(17.4, 19.6, 3000, 12000, 0.12, -0.4, 0.4, 2.5)


def score():
    D = [50, 57, 62, 64, 69]            # Dsus2 colour
    Bm = [47, 54, 59, 62, 66]
    G = [43, 55, 59, 62, 66]
    A = [45, 57, 61, 64, 69]
    pad(0.0, 6.8, D, 0.05, 900)
    pad(6.2, 10.6, Bm, 0.05, 1100)
    pad(10.0, 13.9, G, 0.05, 1200)
    pad(13.4, 17.9, A, 0.055, 1500)
    pad(17.4, 20.0, D + [74], 0.07, 2200)
    # a sparse bell line: one note per shot, landing on the logo
    for t, m, p in ((0.4, 74, -0.3), (3.2, 76, 0.3), (6.6, 78, -0.2), (10.0, 79, 0.25), (13.4, 81, -0.25), (15.4, 83, 0.2)):
        chime(t, m, 0.035, pan=p)
    for k, m in enumerate((62, 66, 69, 74, 78, 81)):
        chime(17.65 + k * 0.05, m, 0.03, decay=1.6, pan=-0.5 + k / 5)


def room(x, seconds=1.6, wet=0.3):
    n = int(seconds * SR)
    t = np.arange(n) / SR
    out = x.copy()
    for ch in range(2):
        ir = rng.standard_normal(n) * np.exp(-t / (seconds / 4))
        ir /= np.sqrt((ir ** 2).sum())
        size = len(x) + n
        out[:, ch] += wet * np.fft.irfft(np.fft.rfft(x[:, ch], size) * np.fft.rfft(ir, size), size)[: len(x)]
    return out


def write_wav(path, x):
    y = np.clip(x, -1, 1)
    pcm = (y * (2 ** 23 - 1)).astype('<i4')
    raw = pcm.reshape(-1).view(np.uint8).reshape(-1, 4)[:, :3].tobytes()
    with wave.open(path, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(3)
        w.setframerate(SR)
        w.writeframes(raw)


def measure(x):
    fd, tmp = tempfile.mkstemp(suffix='.wav')
    os.close(fd)
    try:
        write_wav(tmp, x)
        out = subprocess.run(['ffmpeg', '-nostats', '-hide_banner', '-i', tmp, '-af', 'ebur128=peak=true', '-f', 'null', '-'],
                             capture_output=True, text=True).stderr
    finally:
        os.remove(tmp)
    s = out[out.rfind('Summary:'):]
    return float(re.search(r'I:\s+(-?[\d.]+) LUFS', s).group(1)), float(re.search(r'Peak:\s+(-?[\d.]+) dBFS', s).group(1))


def limit(x, ceiling_db=-1.8):
    thr = 10 ** (ceiling_db / 20)
    n = len(x)
    peak = np.zeros(n)
    for ch in range(2):
        up = np.fft.irfft(np.fft.rfft(x[:, ch]), 4 * n) * 4
        peak = np.maximum(peak, np.abs(up).reshape(n, 4).max(axis=1))
    g = np.minimum(1.0, thr / np.maximum(peak, 1e-9))
    w = 1
    while w < 96:
        g = np.minimum(g, np.minimum(np.roll(g, w), np.roll(g, -w)))
        w *= 2
    win = np.hanning(97)
    return x * np.convolve(g, win / win.sum(), mode='same')[:, None]


def at_lufs(x, target):
    lufs, _ = measure(x)
    return x * 10 ** ((target - lufs) / 20)


if __name__ == '__main__':
    out_path = sys.argv[1] if len(sys.argv) > 1 else 'soundtrack.wav'
    effects()
    score()
    mus = at_lufs(room(music) / np.abs(music).max(), -20.0)
    sfx = at_lufs(room(fx, 0.8, 0.15) / np.abs(fx).max(), -19.0)
    x = mus + sfx
    x /= np.abs(x).max()
    for _ in range(4):
        lufs, _ = measure(x)
        x = limit(x * 10 ** ((-14.0 - lufs) / 20))
    fade = int(0.4 * SR)
    x[-fade:] *= np.linspace(1, 0, fade)[:, None] ** 2
    lufs, tp = measure(x)
    write_wav(out_path, x)
    print(f'{out_path}: {len(x) / SR:.2f} s, {lufs:.1f} LUFS, true peak {tp:.1f} dBTP')
