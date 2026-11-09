#!/usr/bin/env python3
"""Synthesizes every sound effect and music loop used by Lunar Sweep.

All audio is generated procedurally from scratch (no samples), so it is original and
free to use. Output: assets/audio/<key>.ogg (Roblox accepts .ogg / .mp3 uploads).

    python3 tools/synth_audio.py

Requires numpy and ffmpeg on PATH.
"""
import os
import subprocess
import sys
import tempfile
import wave

import numpy as np

SR = 44100
OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "audio")
rng = np.random.default_rng(1969)


# ------------------------------------------------------------------ primitives
def t(dur):
    return np.arange(int(SR * dur)) / SR


def env(n, a=0.005, d=0.1, s=0.6, r=0.2):
    """ADSR envelope of n samples (a/d/r in seconds)."""
    a, d, r = int(a * SR), int(d * SR), int(r * SR)
    a, d, r = max(a, 1), max(d, 1), max(r, 1)
    sus = max(n - a - d - r, 0)
    e = np.concatenate([
        np.linspace(0, 1, a),
        np.linspace(1, s, d),
        np.full(sus, s),
        np.linspace(s, 0, r),
    ])
    return np.pad(e, (0, max(0, n - len(e))))[:n]


def sine(f, dur, phase=0.0):
    return np.sin(2 * np.pi * np.asarray(f) * t(dur) + phase)


def sweep(f0, f1, dur, shape="sine"):
    tt = t(dur)
    f = np.geomspace(max(f0, 1), max(f1, 1), len(tt))
    ph = 2 * np.pi * np.cumsum(f) / SR
    if shape == "square":
        return np.sign(np.sin(ph))
    if shape == "saw":
        return 2 * ((ph / (2 * np.pi)) % 1) - 1
    return np.sin(ph)


def noise(dur):
    return rng.uniform(-1, 1, int(SR * dur))


def lowpass(x, cutoff):
    """One-pole low-pass (cutoff may be an array)."""
    cutoff = np.broadcast_to(np.asarray(cutoff, dtype=float), x.shape)
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc = (1 - a[i]) * x[i] + a[i] * acc
        y[i] = acc
    return y


def highpass(x, cutoff):
    return x - lowpass(x, cutoff)


def note(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


def tone(freq, dur, harmonics=(1, 0.5, 0.25), adsr=(0.005, 0.1, 0.5, 0.2)):
    out = np.zeros(int(SR * dur))
    for i, amp in enumerate(harmonics):
        out += amp * sine(freq * (i + 1), dur)
    return out * env(len(out), *adsr)


def mix(*parts, length=None):
    n = length or max(len(p) for p in parts)
    out = np.zeros(n)
    for p in parts:
        out[: min(n, len(p))] += p[:n]
    return out


def at(x, start, total):
    out = np.zeros(int(SR * total))
    s = int(SR * start)
    e = min(len(out), s + len(x))
    out[s:e] += x[: e - s]
    return out


def echo(x, delay=0.18, fb=0.35, n=4):
    out = x.copy()
    d = int(SR * delay)
    for k in range(1, n + 1):
        shifted = np.zeros_like(x)
        if k * d < len(x):
            shifted[k * d:] = x[: len(x) - k * d] * fb ** k
        out += shifted
    return out


def normalize(x, peak=0.85):
    m = np.max(np.abs(x)) or 1
    return x / m * peak


def loop_fade(x, fade=0.05):
    """Crossfade the tail into the head so a loop is seamless."""
    n = int(SR * fade)
    head, tail = x[:n].copy(), x[-n:].copy()
    ramp = np.linspace(0, 1, n)
    x[:n] = head * ramp + tail * (1 - ramp)
    return x[:-n]


# ------------------------------------------------------------------ sound effects
def sfx():
    s = {}
    s["click"] = tone(1800, 0.05, (1, 0.3), (0.001, 0.02, 0.2, 0.02))
    s["hover"] = tone(1200, 0.04, (1,), (0.002, 0.01, 0.3, 0.02)) * 0.4
    s["open_panel"] = lowpass(noise(0.25), np.linspace(800, 6000, int(SR * 0.25))) * env(int(SR * 0.25), 0.02, 0.1, 0.4, 0.1)
    s["error"] = mix(sweep(220, 140, 0.22, "square") * 0.4, sweep(225, 142, 0.22, "square") * 0.4) * env(int(SR * 0.22), 0.005, 0.05, 0.6, 0.1)
    s["notify"] = mix(at(tone(note(84), 0.18), 0, 0.35), at(tone(note(91), 0.2), 0.09, 0.35))
    # broom swish: band-limited noise with a quick filter sweep
    sw = noise(0.22)
    s["sweep"] = highpass(lowpass(sw, np.linspace(1500, 5000, len(sw))), 400) * env(len(sw), 0.02, 0.08, 0.3, 0.1)
    # vacuum motor: harmonic hum + whine + airy noise, seamless loop
    d = 2.05
    hum = sum(a * sine(110 * k, d) for k, a in [(1, 0.5), (2, 0.35), (3, 0.2), (5, 0.1)])
    whine = 0.15 * sine(1760 + 20 * sine(3, d), d)
    air = lowpass(noise(d), 2500) * 0.6
    s["vacuum_loop"] = loop_fade(hum + whine + air)
    s["pickup"] = mix(sweep(900, 2200, 0.09) * env(int(SR * 0.09), 0.002, 0.03, 0.5, 0.05), at(tone(2400, 0.08, (1,)), 0.05, 0.14))
    arp = [note(m) for m in (76, 79, 83, 88, 91)]
    s["rare_pickup"] = echo(sum(at(tone(f, 0.25, (1, 0.4, 0.1)), i * 0.06, 0.7) for i, f in enumerate(arp)), 0.12, 0.3)
    s["full"] = mix(at(tone(note(55), 0.25, (1, 0.6, 0.3)), 0, 0.6), at(tone(note(50), 0.3, (1, 0.6, 0.3)), 0.22, 0.6))
    thunk = lowpass(noise(0.15), 300) * env(int(SR * 0.15), 0.001, 0.05, 0.2, 0.08) * 2
    whir = sweep(300, 900, 0.35) * 0.25 * env(int(SR * 0.35), 0.05, 0.1, 0.5, 0.15)
    s["deposit"] = mix(thunk, at(whir, 0.08, 0.45))
    coin = lambda f: tone(f, 0.5, (1, 0.6, 0.35, 0.2), (0.001, 0.08, 0.3, 0.35))
    s["cash"] = mix(at(coin(note(88)), 0, 0.8), at(coin(note(95)), 0.08, 0.8))
    fan = [note(m) for m in (60, 64, 67, 72, 76, 79, 84)]
    s["level_up"] = echo(sum(at(tone(f, 0.45, (1, 0.5, 0.3, 0.1)), i * 0.075, 1.4) for i, f in enumerate(fan)), 0.15, 0.25)
    s["purchase"] = mix(at(tone(note(79), 0.2), 0, 0.4), at(tone(note(86), 0.25), 0.07, 0.4))
    hiss = highpass(noise(0.4), 3000) * env(int(SR * 0.4), 0.01, 0.1, 0.3, 0.2) * 0.6
    s["capsule_pack"] = mix(hiss, at(thunk, 0.32, 0.6))
    s["teleport"] = echo(sweep(200, 2400, 0.5) * env(int(SR * 0.5), 0.02, 0.2, 0.5, 0.2) * 0.6 + highpass(noise(0.5), 5000) * 0.15, 0.1, 0.3)
    rumble = lowpass(noise(2.5), np.linspace(150, 1200, int(SR * 2.5))) * env(int(SR * 2.5), 0.3, 0.5, 0.8, 1.0) * 2.2
    s["launch"] = rumble
    s["crate_roll"] = tone(2600, 0.03, (1,), (0.001, 0.01, 0.2, 0.01)) * 0.6
    chord = [note(m) for m in (72, 76, 79, 84)]
    s["crate_reveal"] = echo(mix(*[tone(f, 1.0, (1, 0.5, 0.25), (0.01, 0.2, 0.5, 0.6)) for f in chord]) + at(highpass(noise(0.3), 6000) * env(int(SR * 0.3), 0.001, 0.1, 0.2, 0.15) * 0.3, 0, 1.0), 0.14, 0.3)
    s["robot_beep"] = mix(at(tone(1500, 0.07, (1, 0.2)), 0, 0.25), at(tone(1900, 0.07, (1, 0.2)), 0.1, 0.25))
    s["build_place"] = mix(lowpass(noise(0.2), 400) * env(int(SR * 0.2), 0.001, 0.06, 0.2, 0.1) * 2, at(tone(220, 0.15, (1, 0.5)), 0.02, 0.25))
    s["build_remove"] = sweep(500, 120, 0.3, "saw") * 0.3 * env(int(SR * 0.3), 0.005, 0.1, 0.4, 0.1)
    vic = [note(m) for m in (67, 72, 76, 79)]
    s["sector_clear"] = echo(mix(*[at(tone(f, 0.6, (1, 0.4, 0.2)), i * 0.05, 1.0) for i, f in enumerate(vic)]), 0.16, 0.3)
    boom = lowpass(noise(1.2), np.linspace(2000, 80, int(SR * 1.2))) * env(int(SR * 1.2), 0.002, 0.2, 0.5, 0.8) * 2.5
    s["meteor"] = mix(boom, sweep(80, 40, 1.2) * 0.6 * env(int(SR * 1.2), 0.001, 0.4, 0.3, 0.6))
    s["jetpack"] = highpass(lowpass(noise(0.4), 4000), 600) * env(int(SR * 0.4), 0.01, 0.1, 0.5, 0.2)
    mys = [note(m) for m in (62, 65, 69, 74, 77)]
    s["secret"] = echo(mix(*[at(tone(f, 1.2, (1, 0.3, 0.15), (0.2, 0.3, 0.6, 0.6)), i * 0.12, 1.8) for i, f in enumerate(mys)]), 0.25, 0.4)
    # ambience: low space drone with slow movement (seamless 20 s loop)
    d = 20.05
    tt = t(d)
    drone = 0.4 * np.sin(2 * np.pi * 55 * tt) + 0.25 * np.sin(2 * np.pi * 82.5 * tt + 0.3 * np.sin(2 * np.pi * 0.05 * tt))
    wind = lowpass(noise(d), 300 + 200 * (1 + np.sin(2 * np.pi * 0.1 * tt))) * 0.8
    s["ambience"] = loop_fade(drone + wind)
    return s


# ------------------------------------------------------------------ music
def music(root, scale, bpm, mood, bars=16, seed=0):
    """Generative ambient track: pad chords + arpeggio + soft pulse, loopable."""
    r = np.random.default_rng(seed)
    beat = 60 / bpm
    bar = beat * 4
    dur = bars * bar
    total = np.zeros(int(SR * dur) + SR)
    degrees = {"major": [0, 2, 4, 5, 7, 9, 11], "minor": [0, 2, 3, 5, 7, 8, 10], "dorian": [0, 2, 3, 5, 7, 9, 10], "lydian": [0, 2, 4, 6, 7, 9, 11]}[scale]
    progression = {"calm": [0, 5, 3, 4], "dark": [0, 5, 6, 4], "epic": [0, 3, 4, 5], "ice": [0, 4, 5, 3], "fire": [0, 6, 5, 4]}[mood]

    def deg(d, octave=0):
        return root + degrees[d % 7] + 12 * (d // 7) + 12 * octave

    for b in range(bars):
        chord_root = progression[b % len(progression)]
        start = b * bar
        # pad: 3 voices, slow attack
        for v in (0, 2, 4):
            f = note(deg(chord_root + v, 0))
            pad = (sine(f, bar + 0.6) + 0.3 * sine(f * 2.003, bar + 0.6) + 0.2 * sine(f * 0.5, bar + 0.6))
            pad *= env(len(pad), 0.8, 0.5, 0.7, 0.8) * 0.12
            total += at(pad, start, dur + 1)[: len(total)]
        # bass
        bf = note(deg(chord_root, -2))
        bass = (sine(bf, bar) + 0.4 * sine(bf * 2, bar)) * env(int(SR * bar), 0.02, 0.4, 0.5, 0.3) * 0.18
        total += at(bass, start, dur + 1)[: len(total)]
        # arpeggio
        steps = 8
        for i in range(steps):
            if r.random() < (0.85 if mood in ("epic", "fire") else 0.6):
                d_ = chord_root + [0, 2, 4, 7][r.integers(0, 4)]
                f = note(deg(d_, 1))
                pl = tone(f, beat * 0.9, (1, 0.35, 0.1), (0.004, 0.1, 0.25, 0.3)) * 0.12
                total += at(pl, start + i * beat / 2, dur + 1)[: len(total)]
        # pulse
        if mood in ("epic", "fire", "calm"):
            for i in range(4):
                kick = sweep(120, 45, 0.18) * env(int(SR * 0.18), 0.001, 0.08, 0.2, 0.08) * (0.35 if mood != "calm" else 0.15)
                total += at(kick, start + i * beat, dur + 1)[: len(total)]
    total = echo(total, beat * 0.75, 0.3, 3)
    total = total[: int(SR * dur) + int(SR * 0.05)]
    return loop_fade(total)


# ------------------------------------------------------------------ output
def write_ogg(key, data):
    data = normalize(np.asarray(data, dtype=float))
    pcm = (data * 32767).astype(np.int16)
    os.makedirs(OUT, exist_ok=True)
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        path = tmp.name
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    out = os.path.join(OUT, key + ".ogg")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", path, "-c:a", "libvorbis", "-q:a", "4", out], check=True)
    os.unlink(path)
    return out


def main():
    effects = sfx()
    for key, data in effects.items():
        write_ogg(key, data)
        print("sfx  ", key)
    tracks = {
        "music_hub": (57, "major", 84, "calm", 16, 1),
        "music_explore": (55, "lydian", 92, "calm", 16, 2),
        "music_caves": (52, "dorian", 72, "dark", 16, 3),
        "music_ice": (59, "lydian", 80, "ice", 16, 4),
        "music_ember": (50, "minor", 100, "fire", 16, 5),
        "music_dark": (48, "minor", 66, "dark", 12, 6),
        "music_epic": (53, "minor", 104, "epic", 16, 7),
    }
    for key, (root, scale, bpm, mood, bars, seed) in tracks.items():
        write_ogg(key, music(root, scale, bpm, mood, bars, seed))
        print("music", key)


if __name__ == "__main__":
    sys.exit(main())
