"""THE KING RETURNS - original score + sound design + final mix.

Score: written here as MIDI, rendered with FluidSynth and the FluidR3 GM
soundfont (MIT licence). Sound design (rumble, heartbeat, riser, impacts,
switch clicks, breaths) is synthesised from scratch. Everything is original.
"""
import json, os, subprocess
import numpy as np, soundfile as sf, mido, pyloudnorm
from scipy import signal

SR = 48000
DUR = 90.0
N = int(SR * DUR)
T = np.arange(N) / SR
SF2 = '/usr/share/sounds/sf2/FluidR3_GM.sf2'
OUT = 'audio'
os.makedirs(f'{OUT}/stems', exist_ok=True)
RNG = np.random.default_rng(2026)

NOTE = {'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6,
        'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11}


def n(name):
    p, o = (name[:-1], int(name[-1])) if name[-2] not in '-' else (name[:-2], -1)
    return 12 * (o + 1) + NOTE[p]


def ns(names):
    return [n(x) for x in names.split()]

# ------------------------------------------------------------------ MIDI

TPB = 480
TICKS_PER_S = 960   # tempo 120 bpm


def tk(sec):
    return int(round(sec * TICKS_PER_S))


class Part:
    def __init__(self, name, program, channel=0, volume=110):
        self.name, self.ch, self.ev = name, channel, []
        if channel != 9:
            self.ev.append((0, mido.Message('program_change', program=program, channel=channel)))
        for c, v in ((7, volume), (11, 127), (91, 0), (93, 0)):
            self.cc(0, c, v)

    def cc(self, t, ctrl, val):
        self.ev.append((tk(t), mido.Message('control_change', control=ctrl, value=int(np.clip(val, 0, 127)),
                                            channel=self.ch)))

    def note(self, t, dur, pitch, vel):
        vel = int(np.clip(vel, 1, 127))
        self.ev.append((tk(t), mido.Message('note_on', note=pitch, velocity=vel, channel=self.ch)))
        self.ev.append((tk(t + dur), mido.Message('note_off', note=pitch, velocity=0, channel=self.ch)))

    def chord(self, t, dur, pitches, vel):
        for p in pitches:
            self.note(t, dur, p, vel)

    def ramp(self, t0, t1, v0, v1, ctrl=11, rate=25):
        k = max(2, int((t1 - t0) * rate))
        for i in range(k + 1):
            self.cc(t0 + (t1 - t0) * i / k, ctrl, v0 + (v1 - v0) * i / k)

    def render(self):
        mid = mido.MidiFile(ticks_per_beat=TPB)
        tr = mido.MidiTrack()
        mid.tracks.append(tr)
        tr.append(mido.MetaMessage('set_tempo', tempo=500000, time=0))
        order = {'program_change': 0, 'control_change': 1, 'note_off': 2, 'note_on': 3}
        last = 0
        for t, m in sorted(self.ev, key=lambda e: (e[0], order.get(e[1].type, 4))):
            tr.append(m.copy(time=t - last))
            last = t
        tr.append(mido.MetaMessage('end_of_track', time=tk(2.0)))
        mpath = f'{OUT}/stems/{self.name}.mid'
        wpath = f'{OUT}/stems/{self.name}_raw.wav'
        mid.save(mpath)
        subprocess.run(['fluidsynth', '-ni', '-q', '-g', '0.5', '-R', '0', '-C', '0', '-r', str(SR), '-O', 'float',
                        '-T', 'wav', '-F', wpath, SF2, mpath], check=True, stdout=subprocess.DEVNULL)
        a, sr = sf.read(wpath, dtype='float32', always_2d=True)
        assert sr == SR
        out = np.zeros((N, 2), np.float32)
        m = min(N, len(a))
        out[:m] = a[:m, :2]
        return out

# ------------------------------------------------------------------ the score
DM, BB, FM, CM = 'Dm', 'Bb', 'F', 'C'

piano = Part('piano', 0)
piano.note(10.0, 5.0, n('D5'), 46)
mel = [(24.0, 1, 'A4'), (25.0, 1, 'D5'), (26.0, 1, 'C5'), (27.0, 1, 'A4'),
       (28.0, 1, 'Bb4'), (29.0, 1, 'A4'), (30.0, 2, 'F4'),
       (32.0, 1, 'A4'), (33.0, 1, 'C5'), (34.0, 1, 'Bb4'), (35.0, 1, 'A4'),
       (36.0, 1, 'G4'), (37.0, 0.5, 'A4'), (37.5, 0.5, 'G4'), (38.0, 1.2, 'E4')]
for i, (t, d, p) in enumerate(mel):
    piano.note(t, d * 1.05, n(p), 62 + (4 if i % 4 == 0 else 0) + (i % 3))
lh = [(24.0, 'D3 A3 D4 F4 D4 A3 D4 A3'), (28.0, 'Bb2 F3 Bb3 D4 Bb3 F3 Bb3 F3'),
      (32.0, 'F2 C3 F3 A3 F3 C3 F3 C3'), (36.0, 'C3 G3 C4 E4 C4 G3')]
for t0, notes in lh:
    for j, p in enumerate(notes.split()):
        piano.note(t0 + 0.5 * j, 0.9, n(p), 40 + (6 if j == 0 else 0))
    piano.cc(t0 + 0.02, 64, 127)
    piano.cc(t0 + (3.0 if t0 == 36.0 else 4.0) - 0.06, 64, 0)
piano.chord(43.55, 3.0, ns('A5 D6'), 38)
for t, d, p in [(47.0, 1, 'A5'), (48.0, 1, 'D6'), (49.0, 2, 'C6')]:
    piano.note(t, d, n(p), 44)
theme = [(68.0, 1.0, 'A4'), (69.0, 1.0, 'D5'), (70.0, 1.0, 'C5'), (71.0, 0.5, 'A4'),
         (71.5, 1.0, 'Bb4'), (72.5, 1.0, 'A4'), (73.5, 1.5, 'F4'),
         (75.0, 1.0, 'A4'), (76.0, 1.0, 'C5'), (77.0, 1.0, 'Bb4'), (78.0, 0.5, 'A4'),
         (78.5, 1.0, 'A4'), (79.5, 1.0, 'C#5'), (80.5, 1.3, 'E5')]
for i, (t, d, p) in enumerate(theme):
    piano.note(t, d, n(p) + 12, 66 + i * 2)
piano.cc(82.0, 64, 127)
piano.chord(82.0, 4.0, ns('D1 D2'), 112)
piano.note(83.2, 4.0, n('D6'), 44)

pad = Part('pad', 49)   # slow strings
pad.cc(0, 11, 0)
pad.chord(14.0, 10.2, ns('D3 A3 F4'), 64)
pad.ramp(14.0, 17.0, 0, 88)
pad.ramp(17.9, 18.4, 88, 64)
pad.ramp(18.4, 23.5, 64, 92)
for t0, t1, ch in [(24, 28, 'D3 F3 A3 D4'), (28, 32, 'D3 F3 Bb3 D4'), (32, 36, 'C3 F3 A3 C4'), (36, 39, 'C3 E3 G3 C4'),
                   (39, 43, 'D3 F3 A3 D4'), (43, 47, 'D3 F3 Bb3 D4'), (47, 51, 'D3 G3 Bb3 D4'),
                   (51, 54, 'C#3 E3 A3 C#4')]:
    pad.chord(t0, t1 - t0 + 0.08, ns(ch), 66)
pad.ramp(39.0, 53.9, 84, 110)
for t0, t1, ch in [(55.5, 61.0, 'D4 F4 A4'), (61.0, 64.5, 'D4 F4 Bb4'), (64.5, 68.0, 'E4 G4 C5'),
                   (68.0, 71.5, 'D4 F4 A4 D5'), (71.5, 75.0, 'D4 F4 Bb4 D5'), (75.0, 78.5, 'C4 F4 A4 C5'),
                   (78.5, 81.85, 'C#4 E4 A4 C#5')]:
    pad.chord(t0, t1 - t0 + 0.05, ns(ch), 74)
pad.cc(55.45, 11, 96)
pad.ramp(64.5, 81.8, 96, 127)
pad.chord(82.5, 6.5, ns('D5 A5'), 46)
pad.ramp(83.0, 89.0, 110, 0)

strings = Part('strings', 48)  # sustained tutti for the reveal and return
for t0, t1, ch in [(55.5, 61.0, 'D3 A3 D4'), (61.0, 64.5, 'D3 Bb3 D4'), (64.5, 68.0, 'C3 G3 C4'),
                   (68.0, 71.5, 'D3 A3 D4 F4'), (71.5, 75.0, 'D3 Bb3 D4 F4'), (75.0, 78.5, 'C3 A3 C4 F4'),
                   (78.5, 81.85, 'C#3 A3 C#4 E4')]:
    strings.chord(t0, t1 - t0 + 0.04, ns(ch), 88)
strings.cc(55.45, 11, 80)
strings.ramp(61.0, 68.0, 80, 100)
strings.ramp(68.0, 81.8, 100, 127)
strings.chord(82.0, 3.5, ns('D3 A3 D4'), 120)
strings.ramp(82.3, 86.0, 127, 0)

ost = Part('ostinato', 48)
def ostinato(t0, t1, pat, v0, v1, step=0.25, dur=0.17):
    k = int(round((t1 - t0) / step))
    for i in range(k):
        t = t0 + i * step
        v = v0 + (v1 - v0) * i / max(k - 1, 1) + (14 if i % 4 == 0 else 0)
        ost.note(t, dur, n(pat[i % len(pat)]), v)
ostinato(47.0, 51.0, ['D4', 'D4', 'Bb3', 'D4'], 40, 58)
ostinato(51.0, 54.0, ['C#4', 'E4', 'A3', 'E4'], 58, 82)
ostinato(68.0, 71.5, ['D4', 'D4', 'A3', 'D4'], 72, 82)
ostinato(71.5, 75.0, ['D4', 'D4', 'Bb3', 'D4'], 82, 92)
ostinato(75.0, 78.5, ['C4', 'C4', 'A3', 'C4'], 92, 102)
ostinato(78.5, 81.75, ['C#4', 'C#4', 'A3', 'E4'], 102, 118)

cello = Part('cello', 42)
cello.cc(0, 11, 0)
cello.note(19.0, 9.1, n('D2'), 58)
cello.ramp(19.0, 22.0, 0, 92)
for t0, t1, p in [(28, 32, 'Bb2'), (32, 36, 'F2'), (36, 39, 'C2'), (39, 43, 'D2'), (43, 47, 'Bb2'), (47, 51, 'G2'),
                  (51, 54, 'A2'), (55.5, 61.0, 'D2'), (61.0, 64.5, 'Bb2'), (64.5, 68.0, 'C3'),
                  (68.0, 71.5, 'D2'), (71.5, 75.0, 'Bb2'), (75.0, 78.5, 'F2'), (78.5, 81.85, 'A2')]:
    cello.note(t0, t1 - t0 + 0.05, n(p), 70 if t0 < 55 else 92)
cello.note(82.0, 3.5, n('D2'), 120)
cello.ramp(39.0, 53.9, 92, 118)
cello.cc(55.45, 11, 118)

bass = Part('contrabass', 43)
for t0, t1, p in [(39, 43, 'D2'), (43, 47, 'Bb1'), (47, 51, 'G1'), (51, 54, 'A1'),
                  (55.5, 61.0, 'D2'), (61.0, 64.5, 'Bb1'), (64.5, 68.0, 'C2'),
                  (68.0, 71.5, 'D2'), (71.5, 75.0, 'Bb1'), (75.0, 78.5, 'F1'), (78.5, 81.85, 'A1')]:
    bass.note(t0, t1 - t0 + 0.05, n(p), 72 if t0 < 55 else 100)
bass.note(82.0, 4.0, n('D2'), 125)

brass = Part('brass', 61)
for t0, t1, ch, v in [(55.5, 60.95, 'A2 D3 F3 A3', 104), (61.0, 64.45, 'Bb2 D3 F3 Bb3', 92),
                      (64.5, 67.95, 'G2 C3 E3 G3', 98), (68.0, 71.45, 'A2 D3 F3 A3', 106),
                      (71.5, 74.95, 'Bb2 D3 F3 Bb3', 108), (75.0, 78.45, 'A2 C3 F3 A3', 110),
                      (78.5, 81.85, 'A2 C#3 E3 A3', 114)]:
    brass.chord(t0, t1 - t0, ns(ch), v)
brass.note(80.5, 1.35, n('G3'), 112)
brass.cc(55.45, 11, 127)
brass.ramp(55.6, 56.4, 127, 78)
brass.ramp(60.0, 61.0, 78, 92)
brass.ramp(64.5, 67.9, 88, 122)
brass.cc(68.0, 11, 112)
brass.ramp(78.5, 81.8, 112, 127)
brass.chord(82.0, 3.2, ns('D2 D3 A3'), 127)
brass.ramp(82.2, 86.0, 127, 0)

horn = Part('horn', 60)
horn.note(55.5, 5.45, n('D3'), 92)
for i, (t, d, p) in enumerate(theme):
    horn.note(t, d * 0.98, n(p) - 12, 96 + i)

choir = Part('choir', 52)
choir.cc(0, 11, 70)
for t0, t1, ch in [(68.0, 71.5, 'D4 F4 A4'), (71.5, 75.0, 'D4 F4 Bb4'), (75.0, 78.5, 'C4 F4 A4'),
                   (78.5, 81.85, 'C#4 E4 A4')]:
    choir.chord(t0, t1 - t0 + 0.05, ns(ch), 82)
choir.ramp(68.0, 81.8, 70, 120)
choir.cc(81.95, 11, 120)
choir.chord(82.0, 5.5, ns('D4 A4'), 104)
choir.ramp(83.0, 88.5, 120, 0)

timp = Part('timpani', 47)
timp.note(18.05, 2.0, n('D2'), 52)
def roll(part, t0, t1, p, v0, v1, step):
    k = int((t1 - t0) / step)
    for i in range(k):
        part.note(t0 + i * step, step * 1.5, n(p), v0 + (v1 - v0) * i / max(k - 1, 1))
roll(timp, 49.0, 51.0, 'D2', 20, 48, 0.11)
roll(timp, 51.0, 53.95, 'A1', 48, 92, 0.09)
timp.note(55.5, 3.0, n('D2'), 127)
timp.note(61.0, 2.0, n('Bb1'), 106)
timp.note(64.5, 1.5, n('C2'), 104)
roll(timp, 66.0, 67.95, 'C2', 40, 112, 0.085)
pairs = {68.0: ('D2', 'A1'), 71.5: ('Bb1', 'F2'), 75.0: ('F2', 'C2'), 78.5: ('A1', 'E2')}
for t0, (a, b) in pairs.items():
    for i in range(7):
        t = t0 + i * 0.5
        if t >= 80.0:
            break
        timp.note(t, 0.6, n(a if i % 2 == 0 else b), 88 + (t - 68.0) * 1.8 + (10 if i == 0 else 0))
roll(timp, 80.0, 81.85, 'A1', 72, 127, 0.07)
timp.note(82.0, 4.0, n('D2'), 127)

taiko = Part('taiko', 116)
for t, v in [(55.5, 127), (61.0, 110), (64.5, 100), (68.0, 127), (71.5, 116), (73.0, 98), (75.0, 118),
             (77.0, 100), (78.5, 122), (82.0, 127)]:
    taiko.note(t, 1.5, n('C2'), v)

drums = Part('drums', 0, channel=9)
drums.note(55.5, 0.5, 36, 127)
drums.note(68.0, 0.5, 36, 120)
drums.note(68.0, 3.0, 49, 92)
k = int((81.85 - 80.0) / 0.0625)
for i in range(k):
    drums.note(80.0 + i * 0.0625, 0.06, 38, 26 + 92 * i / k)
drums.note(82.0, 0.5, 36, 127)
drums.note(82.0, 4.0, 57, 100)

PARTS = [piano, pad, strings, ost, cello, bass, brass, horn, choir, timp, taiko, drums]

# ------------------------------------------------------------------ DSP helpers

def sos(kind, f, order=2):
    return signal.butter(order, f, kind, fs=SR, output='sos')


def filt(x, kind, f, order=2):
    return signal.sosfilt(sos(kind, f, order), x, axis=0).astype(np.float32)


def env(points):
    """piecewise-linear envelope from (time, value) points"""
    ts, vs = zip(*points)
    return np.interp(T, ts, vs, left=vs[0], right=vs[-1]).astype(np.float32)


def place(buf, t0, x, gain=1.0):
    i = int(t0 * SR)
    j = min(N, i + len(x))
    if j > i:
        if buf.ndim == 2 and x.ndim == 1:
            buf[i:j] += (x[:j - i] * gain)[:, None]
        else:
            buf[i:j] += x[:j - i] * gain


def tone_drop(f0, f1, dur, decay, drop_time=0.4):
    t = np.arange(int(dur * SR)) / SR
    f = f1 + (f0 - f1) * np.exp(-t / (drop_time / 3))
    ph = 2 * np.pi * np.cumsum(f) / SR
    return (np.sin(ph) * np.exp(-t / decay) * np.minimum(1, t / 0.004)).astype(np.float32)


def noise_burst(dur, decay, lp, hp=20):
    t = np.arange(int(dur * SR)) / SR
    x = RNG.standard_normal(len(t)).astype(np.float32) * np.exp(-t / decay)
    x = filt(x, 'low', lp)
    return filt(x, 'high', hp) if hp > 20 else x


def sweep_bp(x, f0, f1, width=(0.6, 1.6)):
    nn = len(x)
    y = np.zeros(nn, np.float32)
    zi = np.zeros((2, 2))
    blk = 240
    for i in range(0, nn, blk):
        fc = f0 * (f1 / f0) ** (i / nn)
        s_ = signal.butter(2, [fc * width[0], min(fc * width[1], 22000)], 'band', fs=SR, output='sos')
        y[i:i + blk], zi = signal.sosfilt(s_, x[i:i + blk], zi=zi)
    return y


def brown(nn):
    w = RNG.standard_normal(nn).astype(np.float32)
    b = signal.lfilter([1], [1, -0.995], w).astype(np.float32)
    return b / (np.abs(b).max() + 1e-9)


def ir(rt60, length, predelay, seed, damp=3500):
    r = np.random.default_rng(seed)
    nn = int(length * SR)
    t = np.arange(nn) / SR
    x = r.standard_normal((nn, 2)).astype(np.float32) * np.exp(-6.91 * t / rt60)[:, None]
    lp = signal.sosfilt(sos('low', damp), x, axis=0)
    w = np.clip(t / (rt60 * 0.5), 0, 1)[:, None]
    x = x * (1 - w) + lp * w
    x = np.concatenate([np.zeros((int(predelay * SR), 2), np.float32), x])
    return (x / np.sqrt((x ** 2).sum(0, keepdims=True))).astype(np.float32)


HALL = ir(2.4, 3.6, 0.025, 1)
ROOM = ir(0.7, 1.2, 0.012, 2, 5000)


def reverb(x, rir, wet):
    if x.ndim == 1:
        x = np.stack([x, x], 1)
    y = np.stack([signal.fftconvolve(x[:, c], rir[:, c])[:N] for c in range(2)], 1)
    return (x + y * wet).astype(np.float32)


def widen(x, ms=11):
    d = int(ms / 1000 * SR)
    y = x.copy()
    y[d:, 1] = x[:-d, 1]
    return y


def pan(x, p):
    """p in [-1, 1]"""
    m = x.mean(1)
    l, r = np.cos((p + 1) * np.pi / 4), np.sin((p + 1) * np.pi / 4)
    return np.stack([m * l * 1.414, m * r * 1.414], 1).astype(np.float32)


def db(x):
    return 10 ** (x / 20)


def peak_norm(x, to=-1.0):
    p = np.abs(x).max()
    return x * (db(to) / p) if p > 0 else x

# ------------------------------------------------------------------ sound design


def design():
    sfx = np.zeros((N, 2), np.float32)
    amb = np.zeros((N, 2), np.float32)
    br = np.zeros((N, 2), np.float32)
    # rumble: builds to the cut at 10.0, then lives under the absence scene
    rum = filt(filt(brown(N), 'low', 95, 4), 'high', 22)
    rum_env = env([(0, 0), (0.8, 0), (4.0, 0.12), (7.0, 0.38), (9.6, 1.0), (9.97, 1.0), (10.0, 0.22), (23.0, 0.2), (24.5, 0), (90, 0)])
    amb += (rum * rum_env * 0.42)[:, None]
    # D drone
    dr = (np.sin(2 * np.pi * 36.71 * T) * 0.6 + np.sin(2 * np.pi * 73.42 * T + 0.3) * 0.4) * (1 + 0.15 * np.sin(2 * np.pi * 0.13 * T))
    amb += (dr * env([(0, 0), (1.0, 0), (6.0, 0.22), (24.0, 0.22), (26.0, 0), (39.0, 0), (41.0, 0.18), (53.9, 0.3), (54.0, 0), (90, 0)]))[:, None].astype(np.float32)
    # room tone + high air
    pink = signal.lfilter([0.049922, -0.095993, 0.050612, -0.004408], [1, -2.494956, 2.017265, -0.522189],
                          RNG.standard_normal(N)).astype(np.float32)
    pink = filt(pink / np.abs(pink).max(), 'low', 1600)
    amb += (pink * env([(0, 0), (2.5, 0.02), (52, 0.02), (54, 0), (90, 0)]))[:, None]
    air = filt(filt(RNG.standard_normal(N).astype(np.float32), 'high', 5000), 'low', 9000)
    amb += (air * env([(0, 0), (10, 0), (11, 0.012), (23.5, 0.012), (24.5, 0), (90, 0)]))[:, None]
    # majlis hum (60 Hz mains) stops with the lights
    hum = sum(np.sin(2 * np.pi * 60 * k * T) / k ** 1.3 for k in (1, 2, 3, 4)).astype(np.float32)
    amb += (hum * env([(0, 0), (14.0, 0), (14.4, 0.035), (18.0, 0.035), (18.03, 0), (90, 0)]))[:, None]

    def breath(t0, inhale, exhale, g):
        d = inhale + exhale
        x = filt(filt(RNG.standard_normal(int(d * SR)).astype(np.float32), 'high', 450), 'low', 2600)
        tt = np.arange(len(x)) / SR
        e = np.where(tt < inhale, (tt / inhale) ** 1.5, np.exp(-(tt - inhale) / (exhale / 3)))
        place(br, t0, x * e * g)
    breath(5.0, 0.9, 1.4, 0.05)
    breath(54.5, 0.85, 0.0001, 0.06)

    def click(t0, g):
        x = noise_burst(0.05, 0.003, 9000, 1800) * 1.0 + tone_drop(140, 90, 0.05, 0.012) * 0.5
        place(sfx, t0, x * g)
    click(18.0, 0.5)
    click(43.48, 0.55)
    # lamp warming up: soft warm hum and a tiny filament tick
    lamp = sum(np.sin(2 * np.pi * 120 * k * T + k) / k ** 1.6 for k in (1, 2, 3)).astype(np.float32)
    amb += (lamp * env([(0, 0), (43.5, 0), (43.7, 0.02), (46.0, 0.012), (47.2, 0), (90, 0)]))[:, None]
    place(sfx, 18.05, tone_drop(55, 32, 2.5, 0.9) * 0.55)

    def whoosh(t0, dur, g, f0=350, f1=3200):
        nn = int(dur * SR)
        x = RNG.standard_normal(nn).astype(np.float32)
        tt = np.arange(nn) / SR
        y = sweep_bp(x, f0, f1)
        e = np.sin(np.pi * np.clip(tt / dur, 0, 1)) ** 2
        place(sfx, t0, y * e * g)
    whoosh(23.7, 0.6, 0.22)
    for t0 in (27.85, 29.1, 30.35, 31.6):
        whoosh(t0, 0.3, 0.12, 600, 4500)

    # heartbeat: lub-dub every second through the awakening
    for i in range(15):
        t0 = 39.0 + i
        g = 0.3 + 0.28 * i / 14
        place(sfx, t0, tone_drop(78, 46, 0.4, 0.09, 0.08) * g)
        place(sfx, t0 + 0.28, tone_drop(70, 44, 0.35, 0.07, 0.07) * g * 0.6)

    # riser into the drop at 54.0
    d = 3.5
    nn = int(d * SR)
    tt = np.arange(nn) / SR
    x = RNG.standard_normal(nn).astype(np.float32)
    y = sweep_bp(x, 300, 7000, (0.7, 1.4))
    glide = np.sin(2 * np.pi * np.cumsum(110 * (8 ** (tt / d))) / SR).astype(np.float32)
    ris = (y * 0.8 + glide * 0.12) * (tt / d) ** 2.2
    place(sfx, 50.5, ris * 0.33)

    # reveal entrance, accents, suck-back and the title impact
    place(sfx, 55.5, tone_drop(62, 33, 3.5, 1.1) * 0.42)
    place(sfx, 55.5, noise_burst(0.5, 0.08, 1800) * 0.18)
    for t0 in (61.0, 68.0):
        place(sfx, t0, tone_drop(70, 38, 1.5, 0.45) * 0.28)
    rc = filt(RNG.standard_normal(int(1.45 * SR)).astype(np.float32), 'high', 4000)
    rc = (rc * np.exp(-np.arange(len(rc)) / SR / 0.45))[::-1]
    place(sfx, 81.85 - 1.45, rc * 0.2)
    place(sfx, 73.5, (np.sin(2 * np.pi * 1000 * np.arange(int(0.12 * SR)) / SR) *
                      np.minimum(1, np.minimum(np.arange(int(0.12 * SR)), np.arange(int(0.12 * SR))[::-1]) / 240)).astype(np.float32) * 0.06)
    place(sfx, 82.0, tone_drop(68, 33, 7.5, 2.2, 0.5) * 0.38)
    place(sfx, 82.0, noise_burst(1.2, 0.18, 2500) * 0.22)
    wind = filt(filt(brown(N), 'low', 1200), 'high', 150)
    amb += (wind * env([(0, 0), (82.5, 0), (84.0, 0.05), (88.0, 0.04), (89.6, 0), (90, 0)]))[:, None]
    return sfx, amb, br

# ------------------------------------------------------------------ mix


def main():
    stems = {}
    for p in PARTS:
        stems[p.name] = p.render()
        print(f'{p.name:11s} peak {np.abs(stems[p.name]).max():.3f}')
    # relative balance (dB) after peak-normalising each stem
    bal = {'piano': -5, 'pad': -9, 'strings': -9, 'ostinato': -13, 'cello': -11, 'contrabass': -12,
           'brass': -9, 'horn': -9, 'choir': -14, 'timpani': -10, 'taiko': -12, 'drums': -15}
    pans = {'piano': -0.15, 'pad': 0.0, 'strings': 0.0, 'ostinato': 0.25, 'cello': -0.3, 'contrabass': 0.2,
            'brass': 0.2, 'horn': -0.2, 'choir': 0.0, 'timpani': -0.1, 'taiko': 0.1, 'drums': 0.0}
    music = np.zeros((N, 2), np.float32)
    for k, x in stems.items():
        x = peak_norm(x) * db(bal[k])
        x = pan(x, pans[k])
        if k in ('pad', 'strings', 'choir'):
            x = widen(x, 13)
        music += x
    music = reverb(music, HALL, 0.42)
    music *= db(env([(0, 0), (38.5, 0), (39.5, -2.5), (53.9, -2.5), (55.4, 0), (67.5, 0), (68.0, 2.0), (81.8, 2.0), (82.0, 0), (90, 0)]))[:, None]
    sfx, amb, br = design()
    sfx = reverb(sfx, HALL, 0.25)
    br = reverb(br, ROOM, 0.3)
    # hard edits: silence at the drop, the suck-back before the impact
    gate = env([(0, 1), (53.985, 1), (54.0, 0), (55.49, 0), (55.5, 1), (81.84, 1), (81.85, 0), (81.995, 0), (82.0, 1), (90, 1)])
    music *= gate[:, None]
    amb *= gate[:, None]
    sfx *= gate[:, None]

    # voice-over on the timeline
    lines = json.load(open(f'{OUT}/vo/lines.json'))
    vo = np.zeros(N, np.float32)
    act = np.zeros(N, np.float32)
    for L in lines:
        a, sr = sf.read(f"{OUT}/vo/L{L['n']:02d}.wav", dtype='float32')
        i = int(L['start'] * SR)
        vo[i:i + len(a)] += a
        act[max(i - int(0.15 * SR), 0): i + len(a) + int(0.35 * SR)] = 1
    vo = peak_norm(vo, -3.0)
    vo_st = reverb(vo, ROOM, 0.18)
    # duck music + ambience under the voice (smoothed side-chain)
    a_att, a_rel = np.exp(-1 / (0.06 * SR)), np.exp(-1 / (0.45 * SR))
    sm = np.zeros(N, np.float32)
    s_ = 0.0
    for idx in range(0, N, 48):
        tgt = act[idx]
        coef = a_att if tgt > s_ else a_rel
        s_ = tgt + (s_ - tgt) * coef ** 48
        sm[idx:idx + 48] = s_
    depth = env([(0, -6.0), (38.5, -6.0), (39.5, -11.0), (67.5, -11.0), (68.0, -13.5), (90, -13.5)])
    duck = db(depth * sm)[:, None]
    bed = (music + sfx * 0.9 + amb * 0.9 + br)
    mix = bed * duck + vo_st * db(3.0)
    master_fade = env([(0, 1), (88.6, 1), (89.85, 0), (90, 0)])
    mix *= master_fade[:, None]
    bed_d = bed * duck * master_fade[:, None]

    meter = pyloudnorm.Meter(SR)
    lufs = meter.integrated_loudness(mix)
    mix *= db(-14.0 - lufs)
    bed_d *= db(-14.0 - lufs)
    vo_scaled = vo_st * db(3.0) * master_fade[:, None] * db(-14.0 - lufs)
    # true-peak limiter (4x oversampled detection, lookahead, -1.0 dBTP ceiling)
    ceil = db(-1.1)
    up = signal.resample_poly(mix, 4, 1, axis=0)
    pk = np.abs(up).max(1).reshape(-1, 4).max(1)[:N]
    g = np.minimum(1.0, ceil / np.maximum(pk, 1e-9))
    look = int(0.005 * SR)
    g = np.minimum.reduce([np.roll(g, -k) for k in range(0, look, 8)] + [g])
    rel = np.exp(-1 / (0.08 * SR))
    gs = np.empty_like(g)
    cur = 1.0
    for i in range(N):
        cur = g[i] if g[i] < cur else g[i] + (cur - g[i]) * rel
        gs[i] = cur
    mix = mix * gs[:, None]
    np.save(f'{OUT}/limiter_gain.npy', gs[::480])
    mix[-int(0.12 * SR):] = 0
    sf.write(f'{OUT}/final_mix.wav', mix.astype(np.float32), SR, subtype='PCM_24')
    sf.write(f'{OUT}/stems/vo_stem.wav', (vo_scaled * gs[:, None]).astype(np.float32), SR, subtype='PCM_24')
    sf.write(f'{OUT}/stems/music_sfx_stem.wav', (bed_d * gs[:, None]).astype(np.float32), SR, subtype='PCM_24')
    print(f'pre-limit integrated {lufs:.2f} LUFS; limiter min gain {20*np.log10(gs.min()):.2f} dB')

    # report: VO vs bed loudness per line
    for L in lines:
        i0, i1 = int(L['start'] * SR), int((L['start'] + L['dur']) * SR)
        v = meter.integrated_loudness(vo_scaled[i0:i1]) if i1 - i0 > SR * 0.5 else float('nan')
        b = meter.integrated_loudness(bed_d[i0:i1]) if i1 - i0 > SR * 0.5 else float('nan')
        print(f"L{L['n']:02d} @{L['start']:5.1f}s  voice {v:6.1f} LUFS  bed {b:6.1f} LUFS  margin {v - b:5.1f} LU")


if __name__ == '__main__':
    main()
