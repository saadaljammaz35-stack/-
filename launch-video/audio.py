"""Soundtrack for the MEDAD launch sting: music, sound effects and voiceover.

    python audio.py out.wav

The music (124 BPM, soft intro, drop on the f72 cut at 2.467 s, breakdown
over the logo disc, final chord on the end card) and every effect are
synthesised here with a seeded RNG. The voiceover is read from
audio/vo.flac (built by vo_prep.py); the music ducks under it. The mix is
mastered to -14 LUFS integrated with a -1 dBTP true-peak ceiling (EBU R128
via ffmpeg), length exactly 12.075 s.
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
mix = np.zeros((N, 2))      # sound effects
music = np.zeros((N, 2))    # music bus
HERE = os.path.dirname(os.path.abspath(__file__))


def place(sig, t0, pan=0.0, gain=1.0, bus=None):
    """Add a mono or stereo signal starting at t0 seconds (constant-power pan)."""
    if sig.ndim == 1:
        a = (pan + 1) * np.pi / 4
        sig = np.stack([sig * np.cos(a), sig * np.sin(a)], axis=1)
    i0 = int(round(t0 * SR))
    j0 = max(0, -i0)
    i0 = max(0, i0)
    n = min(len(sig) - j0, N - i0)
    if n > 0:
        (mix if bus is None else bus)[i0:i0 + n] += gain * sig[j0:j0 + n]


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


# ── music: 124 BPM, beat k at 0.048 + k·60/124 s ─────────────────────────────
BEAT = 60 / 124


def beat(k):
    return 0.048 + BEAT * k


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


CHORDS = {
    'F': [41, 48, 52, 55, 57, 64],    # Fmaj9
    'C': [48, 52, 55, 59, 62, 67],    # Cmaj9
    'Am': [45, 52, 55, 59, 60, 64],   # Am9
    'G': [43, 50, 52, 55, 57, 59],    # G6/9
}
ROOT = {'F': 41, 'C': 36, 'Am': 45, 'G': 43}
SECTIONS = [  # (start, end, chord) — drop on beat 5, end card at 10.043 s
    (0.0, beat(5), 'F'), (beat(5), beat(9), 'C'), (beat(9), beat(13), 'Am'),
    (beat(13), beat(17), 'F'), (beat(17), 10.043, 'G'), (10.043, DUR, 'C'),
]


def pad(t0, t1, chord, attack, gain, cutoff=(1100, 1100)):
    n = int((t1 - t0 + 0.6) * SR)
    t = np.arange(n) / SR
    cut = np.linspace(cutoff[0], cutoff[1], n)
    env = np.minimum(1, t / attack) * np.clip((t1 - t0 + 0.45 - t) / 0.45, 0, 1)
    L = np.zeros(n)
    R = np.zeros(n)
    for m in CHORDS[chord]:
        for d, (wl, wr) in zip((-7, 0, 7), ((0.9, 0.3), (0.6, 0.6), (0.3, 0.9))):
            f = midi(m) * 2 ** (d / 1200)
            ph = rng.uniform(0, 2 * np.pi)
            v = np.zeros(n)
            for h in range(1, 6):
                if f * h > 6000:
                    break
                v += np.sin(2 * np.pi * f * h * t + ph * h) / (h * h) * np.exp(-f * h / cut)
            L += v * wl
            R += v * wr
    place(np.stack([L, R], axis=1) * env[:, None], t0, gain=gain, bus=music)


def pluck(t0, m, gain, decay=0.14, pan=0.0):
    n = int(max(decay * 6, 0.3) * SR)
    t = np.arange(n) / SR
    f = midi(m)
    sig = (np.sin(2 * np.pi * f * t) + 0.35 * np.sin(4 * np.pi * f * t) * np.exp(-t / (decay / 3)))
    sig *= np.exp(-t / decay) * np.minimum(1, t / 0.002)
    place(sig, t0, pan=pan, gain=gain, bus=music)


def chord_at(t):
    for a, b, c in SECTIONS:
        if a <= t < b:
            return c
    return 'C'


def music_score():
    # pads: the intro filter opens into the drop; the end chord blooms
    for a, b, c in SECTIONS:
        if a == 0.0:
            pad(a, b, c, attack=1.1, gain=0.06, cutoff=(400, 1500))
        elif c == 'G':
            pad(a, b, c, attack=0.25, gain=0.06, cutoff=(900, 1800))
        elif a == 10.043:
            pad(a, b, c, attack=0.04, gain=0.08, cutoff=(2200, 1000))
        else:
            pad(a, b, c, attack=0.05, gain=0.055)
    # risers into the drop and into the end card
    for t_end, length in ((2.44, 1.25), (10.02, 0.9)):
        n = int(length * SR)
        t = np.arange(n) / SR
        sig = band_noise(n, 900, 8000) * (t / length) ** 3
        place(sig, t_end - length, gain=0.14, bus=music)
    # drums + bass from the drop to the breakdown
    kicks = [beat(k) for k in range(5, 17)]
    for k, tk in enumerate(kicks):
        thump_m(tk, 0.55)
        if k % 2 == 1:
            clap(tk, 0.12)
        hat(tk + BEAT / 2, 0.08)
        c = chord_at(tk + 0.01)
        bass(tk + BEAT / 2, ROOT[c], 0.2)
    # sixteenth-note arp: groove, softer through the breakdown
    pattern = [0, 3, 1, 4, 2, 5, 3, 1]
    step = 0
    t = beat(5)
    while t < 10.0:
        c = chord_at(t + 0.01)
        if (step % 8) not in (3, 7) or t < 8.27:
            m = CHORDS[c][pattern[step % 8]] + 12
            soft = 0.55 if t >= 8.27 else 1.0
            pluck(t, m, gain=0.026 * soft, decay=0.12 if t < 8.27 else 0.22, pan=-0.35 + 0.7 * ((step * 3) % 8) / 7)
        t += BEAT / 4
        step += 1
    # end card: sub, a strummed Cmaj9 and the final ring
    thump_m(10.043, 0.6, decay=0.7)
    for k, m in enumerate(CHORDS['C'] + [71, 74, 79]):
        pluck(10.06 + k * 0.035, m + 12, gain=0.03, decay=0.6, pan=-0.5 + k / 8)


def thump_m(t0, gain, decay=0.22):
    n = int(0.6 * SR)
    t = np.arange(n) / SR
    freq = 48 + 80 * np.exp(-t / 0.04)
    sig = np.sin(2 * np.pi * np.cumsum(freq) / SR) * np.exp(-t / decay)
    sig += band_noise(n, 2000, 9000) * np.exp(-t / 0.004) * 0.15
    place(sig, t0, gain=gain, bus=music)


def clap(t0, gain):
    n = int(0.3 * SR)
    t = np.arange(n) / SR
    env = sum(np.exp(-np.clip(t - d, 0, None) / 0.012) * (t >= d) for d in (0, 0.011, 0.022))
    env = env + np.exp(-np.clip(t - 0.022, 0, None) / 0.09) * (t >= 0.022) * 0.6
    place(band_noise(n, 900, 5000) * env, t0, gain=gain, bus=music)


def hat(t0, gain):
    n = int(0.12 * SR)
    t = np.arange(n) / SR
    place(band_noise(n, 7000, 16000) * np.exp(-t / 0.035), t0, pan=0.2, gain=gain, bus=music)


def bass(t0, m, gain):
    n = int(0.32 * SR)
    t = np.arange(n) / SR
    f = midi(m - 12)
    sig = np.tanh(1.6 * (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(4 * np.pi * f * t)))
    sig *= np.minimum(1, t / 0.006) * np.exp(-t / 0.16)
    place(sig, t0, gain=gain, bus=music)


def room(x, seconds=0.9, wet=0.22):
    """Small, soft reverb: convolution with decaying stereo noise."""
    n = int(seconds * SR)
    t = np.arange(n) / SR
    out = x.copy()
    for ch in range(2):
        ir = rng.standard_normal(n) * np.exp(-t / (seconds / 4))
        ir /= np.sqrt((ir ** 2).sum())
        size = len(x) + n
        wetsig = np.fft.irfft(np.fft.rfft(x[:, ch], size) * np.fft.rfft(ir, size), size)[: len(x)]
        out[:, ch] += wet * wetsig
    return out


def sidechain_from_kicks(x):
    g = np.ones(len(x))
    t = np.arange(len(x)) / SR
    for k in range(5, 17):
        tk = beat(k)
        m = t >= tk
        g[m] = np.minimum(g[m], 1 - 0.3 * np.exp(-(t[m] - tk) / 0.11))
    return x * g[:, None]


def load_vo():
    path = os.path.join(HERE, 'audio', 'vo.flac')
    fd, tmp = tempfile.mkstemp(suffix='.wav')
    os.close(fd)
    try:
        subprocess.run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-i', path,
                        '-ac', '1', '-ar', str(SR), '-c:a', 'pcm_s16le', tmp], check=True)
        with wave.open(tmp) as w:
            v = np.frombuffer(w.readframes(w.getnframes()), dtype='<i2').astype(float) / 32768
    finally:
        os.remove(tmp)
    out = np.zeros(N)
    out[: min(N, len(v))] = v[:N]
    spec = np.fft.rfft(out)                          # high-pass 80 Hz
    f = np.fft.rfftfreq(N, 1 / SR)
    out = np.fft.irfft(spec / (1 + (80 / np.maximum(f, 1)) ** 4), N)
    return out


def duck_envelope(vo, depth_db=-10):
    """Gain that dips the music while the voice speaks (10 ms attack, 280 ms release)."""
    level = np.abs(vo)
    hop = 240
    blocks = level[: len(level) // hop * hop].reshape(-1, hop).max(axis=1)
    active = (blocks > 0.02).astype(float)
    sm = np.zeros_like(active)
    for i in range(len(active)):
        prev = sm[i - 1] if i else 0.0
        coef = 0.6 if active[i] > prev else 0.025
        sm[i] = prev + (active[i] - prev) * coef
    g = 1 - (1 - 10 ** (depth_db / 20)) * np.repeat(sm, hop)
    return np.pad(g, (0, len(vo) - len(g)), constant_values=1.0)


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


def limit(x, ceiling_db=-1.8):
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


def at_lufs(x, target):
    lufs, _ = measure(x)
    return x * 10 ** ((target - lufs) / 20)


if __name__ == '__main__':
    out_path = sys.argv[1] if len(sys.argv) > 1 else 'soundtrack.wav'
    music_score()
    mus = sidechain_from_kicks(room(music))
    vo = load_vo()
    vo_st = np.stack([vo, vo], axis=1)
    # balance the three buses, then duck the music under the voice
    mus = at_lufs(mus / np.abs(mus).max(), -24.0) * duck_envelope(vo)[:, None]
    sfx = at_lufs(mix / np.abs(mix).max(), -24.0)
    vo_st = at_lufs(vo_st / np.abs(vo_st).max(), -17.0)
    x = mus + sfx + vo_st
    x /= np.abs(x).max()
    for _ in range(4):
        lufs, _tp = measure(x)
        x = limit(x * 10 ** ((-14.0 - lufs) / 20))
    fade = int(0.060 * SR)
    x[-fade:] *= np.linspace(1, 0, fade)[:, None] ** 2
    lufs, tp = measure(x)
    write_wav(out_path, x)
    print(f'{out_path}: {len(x) / SR:.3f} s, {lufs:.1f} LUFS, true peak {tp:.1f} dBTP')
