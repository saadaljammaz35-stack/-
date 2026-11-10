"""Synthesised sound design for the MEDAD launch sting (no music).

    python audio.py out.wav

Every effect is generated here with a seeded RNG, timed to the film's cuts.
The mix is then mastered to -14 LUFS integrated with a -1 dBTP true-peak
ceiling (loudness measured by ffmpeg's EBU R128 meter), length 12.075 s.
"""
import os
import re
import subprocess
import sys
import tempfile
import wave

import numpy as np

SR = 48000
DUR = 12.075
N = int(round(SR * DUR))
rng = np.random.default_rng(20261110)
mix = np.zeros((N, 2))


def place(sig, t0, pan=0.0, gain=1.0):
    """Add a mono or stereo signal starting at t0 seconds (constant-power pan)."""
    if sig.ndim == 1:
        a = (pan + 1) * np.pi / 4
        sig = np.stack([sig * np.cos(a), sig * np.sin(a)], axis=1)
    i0 = int(round(t0 * SR))
    j0 = max(0, -i0)
    i0 = max(0, i0)
    n = min(len(sig) - j0, N - i0)
    if n > 0:
        mix[i0:i0 + n] += gain * sig[j0:j0 + n]


def band_noise(n, lo, hi):
    spec = np.fft.rfft(rng.standard_normal(n))
    f = np.fft.rfftfreq(n, 1 / SR)
    shape = 1 / (1 + (lo / np.maximum(f, 1)) ** 4) / (1 + (f / hi) ** 4)
    out = np.fft.irfft(spec * shape, n)
    return out / (np.abs(out).max() + 1e-9)


def whoosh(peak, pre=0.5, post=0.2, pan_from=-0.45, pan_to=0.45, gain=1.0):
    n = int((pre + post) * SR)
    t = np.arange(n) / SR - pre                         # 0 at the peak
    rise = np.clip(1 + t / pre, 0, 1) ** 3.2
    fall = np.exp(-np.clip(t, 0, None) / 0.055)
    env = np.where(t < 0, rise, fall)
    k = np.clip(1 + t / pre, 0, 1)                      # sweep: dark air → bright air
    sig = band_noise(n, 180, 1400) * (1 - k) * 0.9 + band_noise(n, 1600, 9000) * k * 0.7
    sig *= env
    pans = np.linspace(pan_from, pan_to, n)
    a = (pans + 1) * np.pi / 4
    place(np.stack([sig * np.cos(a), sig * np.sin(a)], axis=1), peak - pre, gain=gain)


def thump(t0, f_hi=90, f_lo=48, decay=0.32, gain=1.0):
    n = int(1.2 * SR)
    t = np.arange(n) / SR
    freq = f_lo + (f_hi - f_lo) * np.exp(-t / 0.06)
    phase = 2 * np.pi * np.cumsum(freq) / SR
    sig = np.sin(phase) * np.exp(-t / decay) * np.minimum(1, t / 0.003)
    place(sig, t0, gain=gain)


def hit(t0, gain=1.0):
    thump(t0, 110, 46, 0.42, gain=gain)
    n = int(0.5 * SR)
    t = np.arange(n) / SR
    body = band_noise(n, 350, 3200) * np.exp(-t / 0.07)
    click = band_noise(n, 2500, 12000) * np.exp(-t / 0.006)
    place(body * 0.55 + click * 0.35, t0, pan=0.0, gain=gain)


def click(t0, gain=1.0):
    for k, dt in enumerate((0.0, 0.045)):           # press, release
        n = int(0.05 * SR)
        t = np.arange(n) / SR
        tick = band_noise(n, 1800, 11000) * np.exp(-t / 0.0022)
        tone = np.sin(2 * np.pi * (2300 - 400 * k) * t) * np.exp(-t / 0.007)
        place((tick * 0.7 + tone * 0.35) * (1 if k == 0 else 0.55), t0 + dt, pan=0.12, gain=gain)


def key_ticks(t_from, t_to, step=0.032, gain=0.18):
    t = t_from
    i = 0
    while t < t_to:
        n = int(0.03 * SR)
        tt = np.arange(n) / SR
        tick = band_noise(n, 2500, 12000) * np.exp(-tt / 0.0016)
        ping = np.sin(2 * np.pi * (3300 + 180 * (i % 3)) * tt) * np.exp(-tt / 0.004)
        level = 0.75 + 0.25 * rng.random()
        place((tick * 0.8 + ping * 0.25) * level, t, pan=-0.2 + 0.4 * rng.random(), gain=gain)
        t += step + rng.uniform(-0.004, 0.004)
        i += 1


def shimmer(t0, gain=0.5):
    n = int(1.6 * SR)
    t = np.arange(n) / SR
    env = np.minimum(1, t / 0.03) * np.exp(-t / 0.55)
    L = np.zeros(n)
    R = np.zeros(n)
    for k, f in enumerate((2637.0, 3136.0, 3951.1, 5274.0, 6271.9)):
        trem = 1 + 0.15 * np.sin(2 * np.pi * (7 + k) * t)
        L += np.sin(2 * np.pi * f * 0.998 * t + k) * trem / (k + 1.6)
        R += np.sin(2 * np.pi * f * 1.002 * t + 2 * k) * trem / (k + 1.6)
    place(np.stack([L, R], axis=1) * env[:, None], t0, gain=gain)


# ── the score of effects ────────────────────────────────────────────────────
thump(0.10, 80, 50, 0.3, gain=0.55)                  # soft impact on the opening
whoosh(2.402, pre=0.45, post=0.16, gain=0.9)         # cut to the app icon
click(2.33, gain=0.5)                                # click on the logo
whoosh(3.370, pre=0.32, post=0.14, pan_from=0.3, pan_to=-0.3, gain=0.75)   # into the menu bar
click(3.83, gain=0.5)                                # click on the menu-bar icon
key_ticks(4.04, 5.00)                                # typing the prompt
whoosh(5.305, pre=0.5, post=0.2, pan_from=-0.2, pan_to=0.2, gain=1.0)      # whip-tilt
hit(6.240, gain=0.8)                                 # card → stacked cards
hit(8.175, gain=0.7)                                 # stacked cards → logo disc
whoosh(10.043, pre=0.42, post=0.18, gain=0.85)       # cut to the end card
shimmer(10.05, gain=0.55)                            # the wordmark lights up


# ── mastering ──────────────────────────────────────────────────────────────
def measure(x):
    fd, tmp = tempfile.mkstemp(suffix='.wav')
    os.close(fd)
    try:
        write_wav(tmp, x)
        out = subprocess.run(
            ['ffmpeg', '-nostats', '-hide_banner', '-i', tmp,
             '-af', 'ebur128=peak=true', '-f', 'null', '-'],
            capture_output=True, text=True).stderr
    finally:
        os.remove(tmp)
    summary = out[out.rfind('Summary:'):]
    lufs = float(re.search(r'I:\s+(-?[\d.]+) LUFS', summary).group(1))
    tp = float(re.search(r'Peak:\s+(-?[\d.]+) dBFS', summary).group(1))
    return lufs, tp


def limit(x, ceiling_db=-1.3):
    """Look-ahead true-peak limiter: 4x oversampled detection, smooth gain."""
    thr = 10 ** (ceiling_db / 20)
    n = len(x)
    peak = np.zeros(n)
    for ch in range(2):
        up = np.fft.irfft(np.fft.rfft(x[:, ch]), 4 * n) * 4
        peak = np.maximum(peak, np.abs(up).reshape(n, 4).max(axis=1))
    g = np.minimum(1.0, thr / np.maximum(peak, 1e-9))
    w = 1
    while w < 96:                                    # sliding minimum, ±96 samples
        g = np.minimum(g, np.minimum(np.roll(g, w), np.roll(g, -w)))
        w *= 2
    win = np.hanning(97)
    g = np.convolve(g, win / win.sum(), mode='same')
    return x * g[:, None]


def write_wav(path, x):
    y = np.clip(x, -1, 1)
    pcm = (y * (2 ** 23 - 1)).astype('<i4')
    raw = pcm.reshape(-1).view(np.uint8).reshape(-1, 4)[:, :3].tobytes()
    with wave.open(path, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(3)
        w.setframerate(SR)
        w.writeframes(raw)


if __name__ == '__main__':
    out_path = sys.argv[1] if len(sys.argv) > 1 else 'sfx.wav'
    x = mix / np.abs(mix).max()
    for _ in range(4):
        lufs, _tp = measure(x)
        x = limit(x * 10 ** ((-14.0 - lufs) / 20))
    fade = int(0.060 * SR)
    x[-fade:] *= np.linspace(1, 0, fade)[:, None] ** 2
    lufs, tp = measure(x)
    write_wav(out_path, x)
    print(f'{out_path}: {len(x) / SR:.3f} s, {lufs:.1f} LUFS, true peak {tp:.1f} dBTP')
