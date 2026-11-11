"""Soundtrack for «أبي موقع ثلاثي الأبعاد»: music and effects, all composed in code.

    python audio.py out.wav

130 BPM, 32 beats (14.769 s). The song starts 12 beats before its drop, which
lands on the lime flood (beat 12). Every effect sits on the frame its event
happens in index.html (same beat maths, same keystroke rhythm). The mix is
mastered to -14 LUFS integrated with a true-peak ceiling (EBU R128 via ffmpeg).
"""
import math
import re
import subprocess
import sys
import tempfile
import os
import wave

import numpy as np

SR = 48000
BPM = 130
BEAT = 60 / BPM
DUR = 32 * BEAT
N = int(round(SR * DUR))
rng = np.random.default_rng(20261111)
sfx = np.zeros((N, 2))
music = np.zeros((N, 2))


def bt(k):
    return k * BEAT


# ── the film's event times (mirrors index.html) ──────────────────────────────
LINES = ['أبي موقع ثلاثي الأبعاد،', 'فخم ويتحرك مع اللي يتصفحه،', 'ويبهر من أول نظرة']


def js_hash(n):
    s = math.sin(n * 127.1 + 311.7) * 43758.5453123
    return s - math.floor(s)


def keystrokes():
    chars = [(li, ci, ch) for li, line in enumerate(LINES) for ci, ch in enumerate(line)]
    raw = []
    for i, (li, ci, ch) in enumerate(chars):
        d = 0.032 + 0.03 * js_hash(i + 7)
        if ch == ' ':
            d += 0.05
        if ch == '،':
            d += 0.12
        if ci == 0 and li > 0:
            d += 0.1
        raw.append(d)
    start, end = bt(0.55), bt(5.55)
    total = sum(raw)
    acc, out = start, []
    for (li, ci, ch), d in zip(chars, raw):
        acc += d * (end - start) / total
        out.append((acc, ch))
    return out


SEND_AT = bt(6)
LIFT_AT = bt(6) + 0.3
MORPH_AT = bt(7)
DROP = bt(12)
BACK = bt(16)
REPLY_AT, ASK_AT, PILLS_AT = bt(17.4), bt(18.6), bt(19.1)
CLICK_AT, DONE_AT = bt(20) - 0.06, bt(20.75)
PAGE_AT = bt(21.2)
WORDS_AT = bt(24.6)
ROUTE_AT, PIN_AT, COURIER = bt(28.2), bt(28.7), (bt(28.8), bt(30.4))
MARK_AT = bt(30.55)


# ── building blocks ──────────────────────────────────────────────────────────
def place(sig, t0, pan=0.0, gain=1.0, bus=None):
    if sig.ndim == 1:
        a = (pan + 1) * np.pi / 4
        sig = np.stack([sig * np.cos(a), sig * np.sin(a)], axis=1)
    i0 = int(round(t0 * SR))
    j0 = max(0, -i0)
    i0 = max(0, i0)
    n = min(len(sig) - j0, N - i0)
    if n > 0:
        (sfx if bus is None else bus)[i0:i0 + n] += gain * sig[j0:j0 + n]


def band_noise(n, lo, hi):
    spec = np.fft.rfft(rng.standard_normal(n))
    f = np.fft.rfftfreq(n, 1 / SR)
    shape = 1 / (1 + (lo / np.maximum(f, 1)) ** 4) / (1 + (f / hi) ** 4)
    out = np.fft.irfft(spec * shape, n)
    return out / (np.abs(out).max() + 1e-9)


def env_ar(n, attack, decay):
    t = np.arange(n) / SR
    return np.minimum(1, t / max(attack, 1e-4)) * np.exp(-t / decay)


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


# ── effects ──────────────────────────────────────────────────────────────────
def key_tick(t0, i, gain):
    n = int(0.04 * SR)
    t = np.arange(n) / SR
    tick = band_noise(n, 2200, 11000) * np.exp(-t / 0.0018)
    body = np.sin(2 * np.pi * (1900 + 160 * (i % 4)) * t) * np.exp(-t / 0.005)
    thock = np.sin(2 * np.pi * 240 * t) * np.exp(-t / 0.012)
    place(tick * 0.7 + body * 0.22 + thock * 0.25, t0, pan=-0.15 + 0.3 * js_hash(i), gain=gain)


def pop(t0, f0=520, f1=980, gain=1.0, pan=0.0, decay=0.07):
    n = int(0.25 * SR)
    t = np.arange(n) / SR
    f = f0 + (f1 - f0) * (1 - np.exp(-t / 0.02))
    sig = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_ar(n, 0.002, decay)
    sig += band_noise(n, 1500, 8000) * np.exp(-t / 0.004) * 0.25
    place(sig, t0, pan=pan, gain=gain)


def whoosh(peak, pre=0.35, post=0.18, pan_from=-0.4, pan_to=0.4, gain=1.0, lo=200, hi=7000):
    n = int((pre + post) * SR)
    t = np.arange(n) / SR - pre
    env = np.where(t < 0, np.clip(1 + t / pre, 0, 1) ** 3, np.exp(-np.clip(t, 0, None) / 0.06))
    k = np.clip(1 + t / pre, 0, 1)
    sig = (band_noise(n, lo, 1400) * (1 - k) * 0.9 + band_noise(n, 1500, hi) * k * 0.7) * env
    pans = np.linspace(pan_from, pan_to, n)
    a = (pans + 1) * np.pi / 4
    place(np.stack([sig * np.cos(a), sig * np.sin(a)], axis=1), peak - pre, gain=gain)


def toss(t0, k):
    # the wok flicks: a short metal tap and an airy flip, each a little higher
    n = int(0.4 * SR)
    t = np.arange(n) / SR
    tap = sum(np.sin(2 * np.pi * f * t) * np.exp(-t / d) for f, d in ((1180, 0.05), (2950, 0.03), (4400, 0.02)))
    place(tap * env_ar(n, 0.001, 0.09) * 0.35, t0, pan=0.1, gain=0.55)
    whoosh(t0 + 0.16, pre=0.14, post=0.12, pan_from=-0.2 + 0.1 * k, pan_to=0.25, gain=0.45, lo=600)
    # the shapes land back in the pan
    pop(t0 + BEAT * 0.9, 700 + 90 * k, 420, gain=0.25, decay=0.03)


def impact(t0, gain=1.0):
    n = int(1.4 * SR)
    t = np.arange(n) / SR
    f = 44 + 110 * np.exp(-t / 0.05)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.45)
    crack = band_noise(n, 300, 6000) * np.exp(-t / 0.05)
    air = band_noise(n, 3000, 14000) * np.exp(-t / 0.35) * 0.25
    place(sub * 0.9 + crack * 0.45 + air, t0, gain=gain)


def click(t0, gain=1.0):
    for k, dt in enumerate((0.0, 0.07)):
        n = int(0.05 * SR)
        t = np.arange(n) / SR
        tick = band_noise(n, 1800, 11000) * np.exp(-t / 0.0022)
        tone = np.sin(2 * np.pi * (2400 - 450 * k) * t) * np.exp(-t / 0.007)
        place((tick * 0.7 + tone * 0.35) * (1 if k == 0 else 0.55), t0 + dt, pan=0.2, gain=gain)


def spinner(t0, t1, gain):
    n = int((t1 - t0) * SR)
    t = np.arange(n) / SR
    sig = band_noise(n, 2500, 7000) * (0.5 + 0.5 * np.sin(2 * np.pi * 9 * t)) ** 2
    sig *= np.minimum(1, t / 0.05) * np.minimum(1, (t[-1] - t) / 0.05 + 1e-3)
    place(sig, t0, gain=gain)


def success(t0, gain=1.0):
    for k, m in enumerate((76, 83, 88)):                 # E5 B5 E6, a bright rising third
        n = int(1.0 * SR)
        t = np.arange(n) / SR
        f = midi(m)
        sig = (np.sin(2 * np.pi * f * t) + 0.25 * np.sin(4 * np.pi * f * t)) * env_ar(n, 0.003, 0.32)
        place(sig, t0 + k * 0.065, pan=-0.2 + 0.2 * k, gain=gain * (0.9 - 0.15 * k))


def soft_tick(t0, gain=0.3, pan=0.0):
    n = int(0.06 * SR)
    t = np.arange(n) / SR
    place(band_noise(n, 3000, 12000) * np.exp(-t / 0.006), t0, pan=pan, gain=gain)


def sparkle(t0, gain=0.6):
    n = int(1.8 * SR)
    t = np.arange(n) / SR
    env = np.minimum(1, t / 0.02) * np.exp(-t / 0.6)
    L = np.zeros(n)
    R = np.zeros(n)
    for k, f in enumerate((2637.0, 3136.0, 3951.1, 5274.0, 6271.9, 7902.1)):
        trem = 1 + 0.2 * np.sin(2 * np.pi * (6 + 1.3 * k) * t)
        on = (t >= 0.035 * k)
        L += np.sin(2 * np.pi * f * 0.998 * t + k) * trem / (k + 1.5) * on
        R += np.sin(2 * np.pi * f * 1.002 * t + 2 * k) * trem / (k + 1.5) * on
    place(np.stack([L, R], axis=1) * env[:, None], t0, gain=gain)


def riser(t_end, length, gain):
    n = int(length * SR)
    t = np.arange(n) / SR
    sig = band_noise(n, 800, 9000) * (t / length) ** 3
    place(sig, t_end - length, gain=gain)


def courier(t0, t1, gain):
    # a small motor-like hum that glides up as the dot reaches the pin
    n = int((t1 - t0) * SR)
    t = np.arange(n) / SR
    f = 330 + 330 * (t / t[-1]) ** 2
    sig = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.3 * np.sin(4 * np.pi * np.cumsum(f) / SR)
    sig *= np.minimum(1, t / 0.08) * np.minimum(1, (t[-1] - t) / 0.06 + 1e-3) * (0.6 + 0.4 * np.sin(2 * np.pi * 12 * t) ** 2)
    place(sig, t0, pan=-0.3, gain=gain)


def effects():
    for i, (t, ch) in enumerate(keystrokes()):
        key_tick(t, i, 0.16 if ch != ' ' else 0.22)
    pop(SEND_AT, 480, 1050, gain=0.75)                      # send
    whoosh(LIFT_AT + 0.25, pre=0.3, post=0.15, pan_from=0.2, pan_to=-0.3, gain=0.4)   # bubble lifts
    whoosh(MORPH_AT + 0.25, pre=0.25, post=0.1, gain=0.25, lo=500)                     # button → wok
    for k in (8, 9, 10, 11):
        toss(bt(k), k - 8)
    riser(DROP, 1.2, 0.18)
    impact(DROP, 1.0)                                       # the flood
    for i in range(5):                                      # cards burst out
        whoosh(DROP + 0.18 + abs(i - 2) * 0.045, pre=0.12, post=0.1, pan_from=0, pan_to=(i - 2) / 2.5, gain=0.18, lo=900)
    whoosh(bt(14.2), pre=0.55, post=0.2, pan_from=-0.5, pan_to=0.5, gain=0.5)          # the strip slides
    pop(bt(15.1), 620, 1240, gain=0.4, decay=0.06)          # best-match pill
    whoosh(BACK + 0.3, pre=0.3, post=0.2, pan_from=0.4, pan_to=-0.1, gain=0.55)       # flood → bubble, card → slot
    soft_tick(REPLY_AT, 0.25)
    soft_tick(ASK_AT, 0.22, pan=0.2)
    pop(PILLS_AT, 560, 900, gain=0.25, decay=0.04)
    pop(PILLS_AT + 0.07, 600, 950, gain=0.2, decay=0.04, pan=-0.2)
    click(CLICK_AT, 0.65)
    spinner(CLICK_AT + 0.12, DONE_AT, 0.07)
    success(DONE_AT, 0.4)
    whoosh(bt(22.6), pre=0.85, post=0.3, pan_from=-0.1, pan_to=0.1, gain=0.7, lo=120)  # button becomes the page
    for li, words in enumerate((4, 3)):                     # the promise, word by word
        for wi in range(words):
            soft_tick(WORDS_AT + li * 0.9 + wi * 0.16 + 0.05, 0.12, pan=0.3 - 0.2 * wi)
    pop(PIN_AT, 300, 520, gain=0.3, decay=0.08)
    courier(COURIER[0], COURIER[1], 0.06)
    impact(MARK_AT, 0.55)
    sparkle(MARK_AT + 0.02, 0.5)


# ── music: F – G – Am intro, drop into F C Am G, home on C under the mark ───
CHORDS = {
    'F': [41, 48, 52, 55, 57, 64], 'G': [43, 50, 55, 59, 62, 67], 'Am': [45, 52, 55, 60, 64, 67],
    'C': [36, 48, 52, 55, 59, 62], 'Fadd9': [41, 48, 53, 55, 57, 60],
}
ROOT = {'F': 41, 'G': 43, 'Am': 45, 'C': 36, 'Fadd9': 41}
# (from beat, to beat, chord)
FORM = [(0, 4, 'F'), (4, 8, 'G'), (8, 12, 'Am'), (12, 16, 'F'), (16, 20, 'C'), (20, 24, 'Am'),
        (24, 28, 'Fadd9'), (28, 30.55, 'G'), (30.55, 32, 'C')]


def chord_at(beat):
    for a, b, c in FORM:
        if a <= beat < b:
            return c
    return 'C'


def pad(t0, t1, chord, attack, gain, cutoff=(1200, 1200)):
    n = int((t1 - t0 + 0.6) * SR)
    t = np.arange(n) / SR
    cut = np.linspace(cutoff[0], cutoff[1], n)
    env = np.minimum(1, t / attack) * np.clip((t1 - t0 + 0.45 - t) / 0.45, 0, 1)
    L = np.zeros(n)
    R = np.zeros(n)
    for m in CHORDS[chord]:
        for d, (wl, wr) in zip((-8, 0, 8), ((0.9, 0.3), (0.6, 0.6), (0.3, 0.9))):
            f = midi(m) * 2 ** (d / 1200)
            ph = rng.uniform(0, 2 * np.pi)
            v = np.zeros(n)
            for h in range(1, 6):
                if f * h > 7000:
                    break
                v += np.sin(2 * np.pi * f * h * t + ph * h) / (h * h) * np.exp(-f * h / cut)
            L += v * wl
            R += v * wr
    place(np.stack([L, R], axis=1) * env[:, None], t0, gain=gain, bus=music)


def pluck(t0, m, gain, decay=0.14, pan=0.0):
    n = int(max(decay * 6, 0.3) * SR)
    t = np.arange(n) / SR
    f = midi(m)
    sig = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(4 * np.pi * f * t) * np.exp(-t / (decay / 3))
    sig *= np.exp(-t / decay) * np.minimum(1, t / 0.002)
    place(sig, t0, pan=pan, gain=gain, bus=music)


def kick(t0, gain, decay=0.24):
    n = int(0.7 * SR)
    t = np.arange(n) / SR
    f = 46 + 90 * np.exp(-t / 0.035)
    sig = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / decay)
    sig += band_noise(n, 2000, 9000) * np.exp(-t / 0.004) * 0.15
    place(sig, t0, gain=gain, bus=music)


def clap(t0, gain):
    n = int(0.3 * SR)
    t = np.arange(n) / SR
    e = sum(np.exp(-np.clip(t - d, 0, None) / 0.012) * (t >= d) for d in (0, 0.011, 0.022))
    e = e + np.exp(-np.clip(t - 0.022, 0, None) / 0.1) * (t >= 0.022) * 0.6
    place(band_noise(n, 900, 5200) * e, t0, gain=gain, bus=music)


def hat(t0, gain, pan=0.2, decay=0.03):
    n = int(0.12 * SR)
    t = np.arange(n) / SR
    place(band_noise(n, 7000, 16000) * np.exp(-t / decay), t0, pan=pan, gain=gain, bus=music)


def bass(t0, m, gain, length=0.3):
    n = int((length + 0.1) * SR)
    t = np.arange(n) / SR
    f = midi(m - 12)
    sig = np.tanh(1.7 * (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(4 * np.pi * f * t)))
    sig *= np.minimum(1, t / 0.006) * np.exp(-t / (length * 0.55))
    place(sig, t0, gain=gain, bus=music)


KICKS = []


def score():
    # intro: the pad breathes open towards the drop; a plucked line over the typing
    for a, b, c in FORM:
        if b <= 12:
            pad(bt(a), bt(b), c, attack=0.35 if a else 0.9, gain=0.05, cutoff=(350 + 70 * a, 600 + 90 * b))
        elif a < 30.55:
            pad(bt(a), bt(b), c, attack=0.04, gain=0.05, cutoff=(1300, 1300))
        else:
            pad(bt(a), DUR, c, attack=0.02, gain=0.075, cutoff=(2400, 1100))
    melody = [(0, 69), (1.5, 72), (3, 76), (4, 74), (5.5, 71), (7, 67), (8, 72), (9, 76), (10, 79), (10.75, 81), (11.5, 83)]
    for b, m in melody:
        pluck(bt(b), m, 0.03, decay=0.3, pan=0.25)
    # the tosses get a hat and a little tom, so the think beats already groove
    for k in range(8, 12):
        hat(bt(k), 0.07)
        hat(bt(k + 0.5), 0.05, pan=-0.2)
    # drop: four on the floor from beat 12, half-time across the page fill, back for the words
    for k in range(12, 31):
        if 21 <= k < 24 and k % 2:
            continue
        KICKS.append(bt(k))
        kick(bt(k), 0.6)
        if k % 2 == 1 and not 21 <= k < 24:
            clap(bt(k), 0.13)
        hat(bt(k + 0.5), 0.08)
        if k >= 16:
            hat(bt(k + 0.25), 0.035, pan=-0.3)
            hat(bt(k + 0.75), 0.035, pan=-0.3)
        c = chord_at(k + 0.01)
        bass(bt(k + 0.5), ROOT[c], 0.18)
    # sixteenth arp over the groove
    pattern = [0, 3, 1, 4, 2, 5, 3, 1]
    step = 0
    b = 12.0
    while b < 30.5:
        c = chord_at(b + 0.01)
        quiet = 21 <= b < 24
        if not quiet or step % 2 == 0:
            pluck(bt(b), CHORDS[c][pattern[step % 8]] + 12, 0.024 * (0.6 if quiet else 1), decay=0.12, pan=-0.35 + 0.7 * ((step * 3) % 8) / 7)
        b += 0.25
        step += 1
    # home: the mark lands on C, strummed, and rings out
    kick(bt(30.55), 0.65, decay=0.6)
    for k, m in enumerate(CHORDS['C'][1:] + [64, 67, 71, 74]):
        pluck(bt(30.55) + 0.02 + k * 0.03, m + 12, 0.028, decay=0.7, pan=-0.5 + k / 9)


def room(x, seconds=0.9, wet=0.2):
    n = int(seconds * SR)
    t = np.arange(n) / SR
    out = x.copy()
    for ch in range(2):
        ir = rng.standard_normal(n) * np.exp(-t / (seconds / 4))
        ir /= np.sqrt((ir ** 2).sum())
        size = len(x) + n
        out[:, ch] += wet * np.fft.irfft(np.fft.rfft(x[:, ch], size) * np.fft.rfft(ir, size), size)[: len(x)]
    return out


def sidechain(x):
    g = np.ones(len(x))
    t = np.arange(len(x)) / SR
    for tk in KICKS:
        m = t >= tk
        g[m] = np.minimum(g[m], 1 - 0.32 * np.exp(-(t[m] - tk) / 0.1))
    return x * g[:, None]


# ── mastering ────────────────────────────────────────────────────────────────
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
    summary = out[out.rfind('Summary:'):]
    return (float(re.search(r'I:\s+(-?[\d.]+) LUFS', summary).group(1)),
            float(re.search(r'Peak:\s+(-?[\d.]+) dBFS', summary).group(1)))


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
    mus = sidechain(room(music))
    mus = at_lufs(mus / np.abs(mus).max(), -19.0)
    fx = at_lufs(room(sfx, 0.5, 0.12) / np.abs(sfx).max(), -20.0)
    x = mus + fx
    x /= np.abs(x).max()
    for _ in range(4):
        lufs, _tp = measure(x)
        x = limit(x * 10 ** ((-14.0 - lufs) / 20))
    fade = int(0.08 * SR)
    x[-fade:] *= np.linspace(1, 0, fade)[:, None] ** 2
    lufs, tp = measure(x)
    write_wav(out_path, x)
    print(f'{out_path}: {len(x) / SR:.3f} s, {lufs:.1f} LUFS, true peak {tp:.1f} dBTP')
