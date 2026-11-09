#!/usr/bin/env python3
"""
CRUST sting — the 12.075 s bed, synthesised from scratch.

No samples, no library: the network here cannot reach a music host, so the
track is built out of oscillators and a seeded noise generator. 124 BPM,
soft intro, the drop on beat 5 (2.467 s), and the SFX sitting exactly on the
cuts the film makes. Mastering (-14 LUFS, -1 dBTP) is done afterwards by
ffmpeg's loudnorm; this writes the raw, unnormalised mix.
"""
import math, array, wave, sys

SR   = 48000
DUR  = 12.075
N    = int(round(DUR * SR))
BPM  = 124.0
BEAT = 60.0 / BPM                 # 0.483871 s
B0   = 0.048                      # beat 0 lands here
def beat(k): return B0 + BEAT * k

DROP = beat(5)                    # 2.4674 s

# ── deterministic noise (no random module: the film must be reproducible) ──
_s = 0x2A1710
def noise():
    global _s
    _s = (1664525 * _s + 1013904223) & 0xFFFFFFFF
    return (_s / 2147483648.0) - 1.0

buf = [0.0] * N

def idx(t): return int(t * SR)

def add(t0, samples, gain=1.0):
    i = idx(t0)
    for k, v in enumerate(samples):
        j = i + k
        if 0 <= j < N:
            buf[j] += v * gain

# ── envelopes ─────────────────────────────────────────────────────────────
def exp_env(n, tau):
    return [math.exp(-k / (tau * SR)) for k in range(n)]

def ar_env(n, atk, rel):
    a = max(1, int(atk * SR)); out = []
    for k in range(n):
        if k < a: out.append(k / a)
        else:
            x = (k - a) / max(1.0, (n - a))
            out.append(math.exp(-3.4 * x))
    return out

# ── voices ────────────────────────────────────────────────────────────────
def kick(t0, g=0.95):
    n = int(0.30 * SR); ph = 0.0; out = []
    for k in range(n):
        x = k / SR
        f = 48.0 + 92.0 * math.exp(-x / 0.021)          # 140 Hz -> 48 Hz
        ph += 2 * math.pi * f / SR
        a = math.exp(-x / 0.085)
        out.append(math.sin(ph) * a)
    add(t0, out, g)

def bass(t0, f, dur=0.40, g=0.46):
    n = int(dur * SR); ph = 0.0; out = []
    for k in range(n):
        x = k / SR
        ph += 2 * math.pi * f / SR
        a = (1 - math.exp(-x / 0.004)) * math.exp(-x / 0.17)
        out.append((math.sin(ph) + 0.22 * math.sin(2 * ph)) * a)
    add(t0, out, g)

def pluck(t0, f, g=0.10):
    n = int(0.26 * SR); ph = 0.0; out = []
    for k in range(n):
        x = k / SR
        ph += 2 * math.pi * f / SR
        a = (1 - math.exp(-x / 0.002)) * math.exp(-x / 0.055)
        out.append((math.sin(ph) + 0.30 * math.sin(2 * ph) + 0.12 * math.sin(3 * ph)) * a)
    add(t0, out, g)

def hat(t0, g=0.065, dur=0.045):
    n = int(dur * SR); out = []; hp = 0.0; prev = 0.0
    for k in range(n):
        x = noise()
        hp = 0.82 * (hp + x - prev); prev = x          # one-pole highpass
        out.append(hp * math.exp(-(k / SR) / 0.011))
    add(t0, out, g)

def pad(t0, freqs, dur, g=0.11, open_from=0.0):
    """detuned saw-ish stack through a slowly opening one-pole lowpass"""
    n = int(dur * SR)
    phs = []
    for f in freqs:
        for d in (-0.0022, 0.0, 0.0031):
            phs.append([f * (1 + d), 0.0])
    env = ar_env(n, 0.42, 1.0)
    lp = 0.0; out = []
    for k in range(n):
        x = k / SR
        s = 0.0
        for p in phs:
            p[1] += 2 * math.pi * p[0] / SR
            s += math.sin(p[1]) + 0.34 * math.sin(2 * p[1]) + 0.16 * math.sin(3 * p[1])
        s /= len(phs)
        cut = 420.0 + 2600.0 * min(1.0, (x + open_from) / 2.6)
        a = 1 - math.exp(-2 * math.pi * cut / SR)
        lp += a * (s - lp)
        out.append(lp * env[k])
    add(t0, out, g)

# ── SFX ───────────────────────────────────────────────────────────────────
def whoosh(peak_t, g=0.30, rise=0.26, fall=0.17):
    """band-passed noise whose envelope peaks exactly on the cut"""
    t0 = peak_t - rise
    n = int((rise + fall) * SR)
    lp = 0.0; hp = 0.0; prev = 0.0; out = []
    for k in range(n):
        x = k / SR
        u = x / (rise + fall)
        e = (x / rise) ** 2 if x < rise else math.exp(-((x - rise) / fall) * 3.2)
        nz = noise()
        hp = 0.90 * (hp + nz - prev); prev = nz
        cut = 500.0 + 5200.0 * u                        # sweeps up through the cut
        a = 1 - math.exp(-2 * math.pi * cut / SR)
        lp += a * (hp - lp)
        out.append(lp * e)
    add(t0, out, g)

def hit(t0, f=196.0, g=0.60):
    n = int(0.55 * SR); ph = 0.0; lp = 0.0; prev = 0.0; hp = 0.0; out = []
    for k in range(n):
        x = k / SR
        ph += 2 * math.pi * (f * (1 + 1.6 * math.exp(-x / 0.016))) / SR
        a = math.exp(-x / 0.10)
        nz = noise(); hp = 0.86 * (hp + nz - prev); prev = nz
        lp += (1 - math.exp(-2 * math.pi * 2400 / SR)) * (hp - lp)
        out.append(math.sin(ph) * a + lp * math.exp(-x / 0.028) * 0.5)
    add(t0, out, g)

def impact(t0, g=0.85):
    n = int(0.10 * SR); ph = 0.0; out = []
    for k in range(n):
        x = k / SR
        f = 34.0 + 30.0 * math.exp(-x / 0.014)
        ph += 2 * math.pi * f / SR
        out.append(math.sin(ph) * math.exp(-x / 0.030))
    add(t0, out, g)

def click(t0, g=0.34, dur=0.010, tone=2600.0):
    n = int(dur * SR); out = []
    for k in range(n):
        x = k / SR
        out.append((math.sin(2 * math.pi * tone * x) * 0.6 + noise() * 0.4)
                   * math.exp(-x / 0.0022))
    add(t0, out, g)

def shimmer(t0, g=0.26):
    n = int(1.5 * SR); out = [0.0] * n
    for h, amp, det in ((1, 1.0, 0), (2, .55, 1.6), (3, .34, -2.1), (4.76, .22, 3.0), (6.1, .14, -1.2)):
        f = 1046.5 * h / 2 + det
        for k in range(n):
            x = k / SR
            out[k] += math.sin(2 * math.pi * f * x) * amp * math.exp(-x / (0.42 / (h ** .4)))
    add(t0, out, g / 2.3)

def riser(t1, dur=1.05, g=0.22):
    t0 = t1 - dur; n = int(dur * SR); lp = 0.0; hp = 0.0; prev = 0.0; ph = 0.0; out = []
    for k in range(n):
        x = k / SR; u = x / dur
        nz = noise(); hp = 0.9 * (hp + nz - prev); prev = nz
        cut = 700 + 7000 * u * u
        lp += (1 - math.exp(-2 * math.pi * cut / SR)) * (hp - lp)
        ph += 2 * math.pi * (220 * (1 + 2.4 * u)) / SR
        out.append((lp * 0.8 + math.sin(ph) * 0.18) * (u ** 2.1))
    add(t0, out, g)

# ══════════════════ arrangement ══════════════════
CH = [                                   # (first beat, root, chord tones)
    (5,  110.00, [220.00, 261.63, 329.63]),   # Am
    (9,   87.31, [174.61, 220.00, 261.63]),   # F
    (13, 130.81, [261.63, 329.63, 392.00]),   # C
    (17,  98.00, [196.00, 246.94, 293.66]),   # G
    (21, 110.00, [220.00, 261.63, 329.63]),   # Am
]

# intro pad, filter closed, opening toward the drop
pad(0.0, [220.00, 261.63, 329.63], DROP + 0.25, g=0.085, open_from=0.0)
riser(DROP)
for k in range(2, 5):                    # soft intro shaker on the back half
    hat(beat(k), g=0.030)
    hat(beat(k) + BEAT / 2, g=0.022)

impact(DROP)

for first, root, tones in CH:
    t = beat(first)
    pad(t, tones, BEAT * 4 + 0.5, g=0.125, open_from=2.6)
    for b in range(4):
        tb = beat(first + b)
        if tb > DUR: break
        kick(tb, 0.92 if b == 0 else 0.80)
        bass(tb, root, 0.42, 0.46 if b == 0 else 0.38)
        hat(tb + BEAT / 2, g=0.055)
        hat(tb, g=0.034)
        for e in range(2):               # eighth-note arpeggio
            te = tb + e * BEAT / 2
            if te > DUR: break
            pluck(te, tones[(first + b * 2 + e) % 3] * 2, g=0.075)

# ── SFX, on the film's own frames ──
for t in (2.402, 3.370, 5.305, 10.043):
    whoosh(t, g=0.34)
hit(6.240, 196.0, 0.52)
hit(8.175, 164.81, 0.52)
click(2.330, 0.30)
click(3.830, 0.30)
t = 4.040                                 # key ticks while the prompt types
while t <= 5.000:
    click(t, g=0.055, dur=0.005, tone=4200.0)
    t += 0.032
shimmer(10.050, 0.30)

# ── write ──
peak = max(abs(v) for v in buf) or 1.0
sc = 0.80 / peak
fade = int(0.060 * SR)
out = array.array('h')
for i, v in enumerate(buf):
    v *= sc
    if i >= N - fade:                     # the only fade in the piece
        v *= (N - i) / fade
    v = max(-1.0, min(1.0, v))
    s = int(v * 32767)
    out.append(s); out.append(s)

with wave.open(sys.argv[1] if len(sys.argv) > 1 else 'bed-raw.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes(out.tobytes())
print('wrote %.3f s, peak %.3f' % (N / SR, peak))
