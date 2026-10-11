"""THE KING RETURNS - picture renderer.

Builds every shot from the creator's own photos: graded plates in source
coordinates, then per-frame camera moves, dust, haze, grain and a 2.39:1
letterbox inside a 1920x1080 frame. Text (subtitles, title) is added later
with libass at the delivery resolution.
"""
import sys, os, math, subprocess
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont
from lib import *

WORK = os.path.dirname(os.path.abspath(__file__))
DUR = 90.0
NFRAMES = int(DUR * FPS)

# ---------------------------------------------------------------- helpers

def night(lin, gain, hl=(0.86, 0.98), hl_gain=0.9, src_srgb=None):
    """day-for-night: everything drops by `gain`, the brightest highlights
    (the window) keep most of their energy."""
    L = lum(src_srgb if src_srgb is not None else l2s(lin))
    m = smooth(hl[0], hl[1], L)[..., None]
    return lin * gain + lin * m * hl_gain


def bloom(lin, thresh, sigma, strength, tint=(1, 1, 1)):
    hi = lin * smooth(thresh, thresh * 2.5 + 0.05, lum(lin))[..., None]
    return lin + blur(hi, sigma) * strength * np.array(tint, np.float32)


def feather(h, w, edge):
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    d = np.minimum.reduce([xx, w - 1 - xx, yy, h - 1 - yy])
    return smooth(0, edge, d)[..., None]


def light(h, w, cx, cy, rx, ry, color, gain, power=1.6):
    return radial(h, w, cx, cy, rx, ry, power)[..., None] * np.array(color, np.float32) * gain


def mask(p, sigma=1.5):
    m = cv2.imread(f'{WORK}/masks/p{p}_u2net_human_seg.png', cv2.IMREAD_GRAYSCALE).astype(np.float32) / 255
    return cv2.GaussianBlur(m, (0, 0), sigma) if sigma > 0 else m


def bg_fill_blur(img, m, sigma):
    """blur the background while filling the person's area with nearby background"""
    w = (1 - m).astype(np.float32)
    num = blur(img * w[..., None], sigma)
    den = blur(w, sigma)[..., None] + 1e-4
    return num / den


def rim_band(m, width=6):
    return np.clip(m - blur(m, width), 0, 1) * 3.0


WARM = (1.0, 0.72, 0.45)
COOL = (0.55, 0.72, 1.0)
MOON = (0.62, 0.78, 1.0)

NIGHT_LOOK = dict(wb=(0.86, 0.96, 1.16), sat=0.82, shadow_tint=(-0.012, 0.004, 0.018),
                  high_tint=(0.02, 0.01, -0.01))
WARM_LOOK = dict(wb=(1.06, 0.99, 0.9), sat=0.9, shadow_tint=(-0.01, 0.004, 0.016),
                 high_tint=(0.03, 0.012, -0.02))
MEMORY_LOOK = dict(wb=(1.12, 1.0, 0.82), sat=0.72, shadow_tint=(0.0, 0.0, 0.0),
                   high_tint=(0.04, 0.02, -0.02), black=0.0)

_cache = {}


def cached(fn):
    def wrap():
        if fn.__name__ not in _cache:
            _cache[fn.__name__] = fn()
        return _cache[fn.__name__]
    wrap.__name__ = fn.__name__
    return wrap


def crop(img, x0, y0, x1, y1):
    return img[y0:y1, x0:x1].copy()

# ---------------------------------------------------------------- plates
# Each plate: (sRGB float image, (ox, oy) source offset of its top-left).


@cached
def p_window():
    src = cv2.imread(f'{WORK}/plate_window.png')[:, :, ::-1].astype(np.float32) / 255
    x0, y0, x1, y1 = 200, 880, 1449, 1600
    s = crop(src, x0, y0, x1, y1)
    lin = s2l(s)
    out = night(lin, 0.045, (0.86, 0.985), 1.05, s)
    out = bloom(out, 0.18, 22, 0.55, MOON)
    out = bloom(out, 0.18, 90, 0.35, MOON)
    return finish(out, **NIGHT_LOOK), (x0, y0)


def _pendant_base():
    src = load('04')
    x0, y0, x1, y1 = 380, 330, 1449, 1110
    s = crop(src, x0, y0, x1, y1)
    return s, (x0, y0)


def _shade_mask(s, ox, oy):
    h, w = s.shape[:2]
    r, g, b = s[..., 0], s[..., 1], s[..., 2]
    yellow = ((r + g) / 2 - b)
    m = smooth(0.015, 0.06, yellow) * smooth(0.35, 0.6, (r + g) / 2)
    box = np.zeros((h, w), np.float32)
    for bx0, by0, bx1, by1 in [(918, 640, 988, 870), (983, 630, 1058, 872), (885, 845, 958, 1098)]:
        box[by0 - oy:by1 - oy, bx0 - ox:bx1 - ox] = 1
    box = cv2.GaussianBlur(box, (0, 0), 4)
    m = cv2.GaussianBlur(m * box, (0, 0), 1.5)
    return np.clip(m * 1.4, 0, 1)


@cached
def p_pendant_off():
    s, (ox, oy) = _pendant_base()
    lin = s2l(s)
    h, w = s.shape[:2]
    out = lin * 0.05
    # cool moonbeam from the upper right, falling across the shades
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    d = ((xx - (1100 - ox)) * 0.55 + (yy - (700 - oy)) * 0.835)
    beam = np.exp(-(d / 230.0) ** 2) * smooth(-400, 300, (xx - (700 - ox)))
    out = out + lin * beam[..., None] * 0.22 * np.array(MOON, np.float32)
    out = bloom(out, 0.05, 30, 0.4, MOON)
    return finish(out, **NIGHT_LOOK), (ox, oy)


@cached
def p_pendant_on():
    s, (ox, oy) = _pendant_base()
    lin = s2l(s)
    h, w = s.shape[:2]
    m = _shade_mask(s, ox, oy)[..., None]
    out = lin * 0.05
    out = out + lin * light(h, w, 985 - ox, 760 - oy, 700, 520, (1.0, 0.78, 0.52), 1.5, 1.8)
    out = out + m * np.array((2.2, 1.6, 0.95), np.float32) * (0.35 + lin)
    out = bloom(out, 0.35, 16, 0.55, (1.0, 0.8, 0.55))
    out = bloom(out, 0.35, 110, 0.3, (1.0, 0.75, 0.5))
    return finish(out, **WARM_LOOK), (ox, oy)


@cached
def p_majlis_on():
    src = load('11')
    x0, y0, x1, y1 = 0, 230, 1449, 878
    s = crop(src, x0, y0, x1, y1)
    lin = s2l(s)
    out = night(lin, 0.05, (0.74, 0.95), 0.42, s) * np.array((1.12, 0.98, 0.82), np.float32)
    out = bloom(out, 0.2, 14, 0.8, (1.0, 0.85, 0.65))
    out = bloom(out, 0.2, 70, 0.35, (1.0, 0.8, 0.6))
    return finish(out, **WARM_LOOK), (x0, y0)


@cached
def p_majlis_off():
    src = load('11')
    x0, y0, x1, y1 = 0, 230, 1449, 878
    lin = s2l(crop(src, x0, y0, x1, y1))
    return finish(lin * 0.012, **NIGHT_LOOK), (x0, y0)


@cached
def p_silhouette():
    src = load('06')
    x0, y0, x1, y1 = 200, 880, 1449, 1640
    s = crop(src, x0, y0, x1, y1)
    m = crop(mask('06'), x0, y0, x1, y1)
    lin = s2l(s)
    bgs = bg_fill_blur(s, m, 5)
    bg = night(bg_fill_blur(lin, m, 5), 0.02, (0.82, 0.97), 1.7, bgs)
    bg = bloom(bg, 0.15, 16, 0.75, MOON)
    bg = bloom(bg, 0.15, 80, 0.5, MOON)
    fg = lin * 0.006 + rim_band(m, 5)[..., None] * blur(bg, 10) * 0.6
    out = fg * m[..., None] + bg * (1 - m[..., None])
    return finish(out, **NIGHT_LOOK), (x0, y0)


def memory_plate(p, x0, y0, x1, y1, gain=0.85):
    src = load(p)
    s = crop(src, x0, y0, x1, y1)
    s = blur(s, 2.2)
    lin = s2l(s) * gain
    lin = bloom(lin, 0.35, 25, 0.9, (1.0, 0.85, 0.65))
    return finish(lin, **MEMORY_LOOK), (x0, y0)


@cached
def p_mem10():
    return memory_plate('10', 0, 300, 1449, 1700)


@cached
def p_mem02():
    return memory_plate('02', 200, 900, 1449, 1560, 0.8)


@cached
def p_mem08():
    src = load('08')
    m = mask('08', 2)[..., None]
    lin = s2l(blur(src, 2.0)) * 0.9
    lin = lin * m
    lin = bloom(lin, 0.35, 25, 0.9, (1.0, 0.85, 0.65))
    h, w = src.shape[:2]
    lin = lin * feather(h, w, 200)
    return finish(lin, **MEMORY_LOOK), (0, 0)


@cached
def p_mem11():
    return memory_plate('11', 0, 600, 1449, 1600, 0.95)


@cached
def p_mem03():
    return memory_plate('03', 0, 700, 1449, 1600, 0.8)


@cached
def p_profile_ear():
    src = load('05')
    x0, y0, x1, y1 = 0, 1000, 1449, 1950
    s = crop(src, x0, y0, x1, y1)
    lin = s2l(s)
    h, w = s.shape[:2]
    m = crop(mask('05', 3), x0, y0, x1, y1)[..., None]
    out = lin * 0.05 * np.array(COOL, np.float32) * 1.4
    out = out + lin * light(h, w, 1650 - x0, 1500 - y0, 950, 700, WARM, 1.5, 1.4)
    out = out * (0.22 + 0.78 * m)
    out = bloom(out, 0.2, 20, 0.35, WARM)
    return finish(out, **WARM_LOOK), (x0, y0)


@cached
def p_profile_walk():
    src = load('01')
    x0, y0, x1, y1 = 100, 930, 1449, 1760
    s = crop(src, x0, y0, x1, y1)
    m = crop(mask('01'), x0, y0, x1, y1)[..., None]
    lin = s2l(s)
    h, w = s.shape[:2]
    bg = night(bg_fill_blur(lin, m[..., 0], 3), 0.025, (0.86, 0.985), 1.0, bg_fill_blur(s, m[..., 0], 3))
    bg = bloom(bg, 0.15, 18, 0.6, MOON)
    bg = bloom(bg, 0.15, 80, 0.3, MOON)
    fg = lin * 0.03 + lin * light(h, w, 300 - x0, 1150 - y0, 520, 480, WARM, 0.85, 1.4)
    fg = fg + rim_band(m[..., 0], 5)[..., None] * blur(bg, 8) * 0.5
    out = fg * m + bg * (1 - m)
    return finish(out, **NIGHT_LOOK), (x0, y0)


@cached
def p_profile_up():
    src = load('09')
    x0, y0, x1, y1 = 0, 950, 1449, 1950
    s = crop(src, x0, y0, x1, y1)
    lin = s2l(s)
    h, w = s.shape[:2]
    m = crop(mask('09', 3), x0, y0, x1, y1)[..., None]
    out = lin * 0.035 * np.array(COOL, np.float32) * 1.3
    out = out + lin * light(h, w, -150 - x0, 900 - y0, 1250, 1050, WARM, 1.7, 1.3)
    out = out + lin * light(h, w, 1550 - x0, 1550 - y0, 500, 650, COOL, 0.35, 1.5)
    out = out * (0.2 + 0.8 * m)
    out = bloom(out, 0.25, 22, 0.3, WARM)
    return finish(out, **WARM_LOOK), (x0, y0)


def _portrait(p, key, fill_gain, vig, edge=160):
    """full portrait photo, face lit by `key` (cx, cy, rx, ry, gain), periphery to black"""
    src = load(p)
    lin = s2l(src)
    h, w = src.shape[:2]
    kx, ky, krx, kry, kg = key
    out = lin * fill_gain * np.array(COOL, np.float32)
    out = out + lin * light(h, w, kx, ky, krx, kry, WARM, kg, 1.25)
    vx, vy, vrx, vry = vig
    out = out * (radial(h, w, vx, vy, vrx, vry, 1.2)[..., None] * 0.97 + 0.03)
    m = mask(p, 2.0)[..., None]
    out = out * (0.015 + 0.985 * m)
    out = bloom(out, 0.3, 24, 0.25, WARM)
    out = out * feather(h, w, edge)
    return out


@cached
def p_face_dark():
    src = load('07')
    lin = s2l(src)
    h, w = src.shape[:2]
    m = mask('07', 2.0)[..., None]
    out = lin * 0.010 * np.array(COOL, np.float32)
    out = out + lin * light(h, w, 1500, 1250, 420, 1150, COOL, 0.9, 1.3)   # cool rim on the right cheek
    side = smooth(0.5, 0.8, np.arange(w, dtype=np.float32) / w)[None, :, None]
    out = out + rim_band(m[..., 0], 8)[..., None] * side * np.array(MOON, np.float32) * 0.07
    out = out * m
    out = out * feather(h, w, 160)
    return finish(out, **NIGHT_LOOK), (0, 0)


@cached
def p_face_lit():
    out = _portrait('07', (420, 1150, 1300, 1500, 1.25), 0.05, (700, 1350, 950, 1250))
    h, w = out.shape[:2]
    m = mask('07', 2.0)[..., None]
    out = out + s2l(load('07')) * light(h, w, 1500, 1250, 420, 1150, COOL, 0.6, 1.3) * m * feather(h, w, 160)
    side = smooth(0.5, 0.8, np.arange(w, dtype=np.float32) / w)[None, :, None]
    out = out + rim_band(m[..., 0], 8)[..., None] * side * np.array(MOON, np.float32) * 0.05 * feather(h, w, 160)
    return finish(out, **WARM_LOOK), (0, 0)


@cached
def p_fullbody():
    src = load('04')
    lin = s2l(src)
    h, w = src.shape[:2]
    m = mask('04', 1.5)
    bg = night(bg_fill_blur(lin, m, 3), 0.03, (0.86, 0.985), 1.05, bg_fill_blur(src, m, 3))
    bg = bloom(bg, 0.15, 18, 0.65, MOON)
    bg = bloom(bg, 0.15, 90, 0.4, MOON)
    bg = bg * radial(h, w, 760, 1450, 700, 1150, 0.9)[..., None]
    fg = lin * 0.05 + lin * light(h, w, 700, 1250, 520, 900, WARM, 1.25, 1.2)
    fg = fg + rim_band(m, 6)[..., None] * blur(bg, 10) * 0.8
    m3 = m[..., None]
    out = fg * m3 + bg * (1 - m3)
    out = out * feather(h, w, 170)
    return finish(out, **NIGHT_LOOK), (0, 0)


@cached
def p_present10():
    src = load('10')
    x0, y0, x1, y1 = 0, 300, 1449, 1500
    s = crop(src, x0, y0, x1, y1)
    lin = s2l(s)
    h, w = s.shape[:2]
    m = crop(mask('10', 2), x0, y0, x1, y1)[..., None]
    out = lin * 0.16
    out = out + lin * light(h, w, 450 - x0, 700 - y0, 900, 800, WARM, 0.6, 1.3)
    out = out * (0.55 + 0.45 * m)
    out = out * (radial(h, w, 760 - x0, 760 - y0, 950, 700, 1.0)[..., None] * 0.85 + 0.15)
    out = bloom(out, 0.2, 14, 0.7, (1.0, 0.85, 0.65))
    out = bloom(out, 0.2, 60, 0.3, (1.0, 0.8, 0.6))
    return finish(out, contrast=1.06, **WARM_LOOK), (x0, y0)


@cached
def p_rec():
    src = load('02')
    x0, y0, x1, y1 = 200, 900, 1449, 1560
    s = crop(src, x0, y0, x1, y1)
    lin = s2l(s)
    h, w = s.shape[:2]
    out = night(lin, 0.09, (0.86, 0.985), 0.9, s)
    out = out + lin * light(h, w, 775 - x0, 1180 - y0, 520, 420, WARM, 0.55, 1.4)
    out = bloom(out, 0.18, 16, 0.5, MOON)
    return finish(out, wb=(0.95, 1.0, 1.06), sat=0.85, shadow_tint=(-0.01, 0.004, 0.014),
                  high_tint=(0.01, 0.005, -0.005)), (x0, y0)


@cached
def p_smile():
    out = _portrait('08', (420, 1250, 1300, 1500, 1.35), 0.07, (640, 1450, 1000, 1250))
    return finish(out, contrast=1.04, **WARM_LOOK), (0, 0)


@cached
def p_gobo():
    """the window grille as a light pattern, for the title background"""
    src = cv2.imread(f'{WORK}/plate_window.png')[:, :, ::-1].astype(np.float32) / 255
    g = lum(src[1175:1365, 570:1085])
    g = smooth(0.80, 0.97, g)
    g = cv2.resize(g, (g.shape[1] * 3, g.shape[0] * 3), interpolation=cv2.INTER_CUBIC)
    return cv2.GaussianBlur(g, (0, 0), 5)

# ---------------------------------------------------------------- frame-space effects

class Dust:
    def __init__(self, seed, n=170):
        r = np.random.default_rng(seed)
        self.x = r.uniform(0, AW, n); self.y = r.uniform(0, AH, n)
        self.z = r.uniform(0.2, 1.0, n)            # depth: small = far
        self.vx = r.normal(4, 6, n); self.vy = r.normal(-7, 4, n)
        self.ph = r.uniform(0, 2 * np.pi, n)
        self.fr = r.uniform(0.15, 0.5, n)

    def render(self, t, light_img, amount):
        if amount <= 0:
            return 0
        h, w = AH, AW
        lay = np.zeros((h // 2, w // 2), np.float32)
        gl = cv2.resize(light_img, (w // 8, h // 8), interpolation=cv2.INTER_AREA)
        gl = cv2.GaussianBlur(gl, (0, 0), 3)
        x = (self.x + self.vx * t * self.z + 9 * np.sin(self.ph + t * self.fr)) % w
        y = (self.y + self.vy * t * self.z + 6 * np.cos(self.ph * 1.3 + t * self.fr)) % h
        for xi, yi, zi in zip(x, y, self.z):
            li = max(float(gl[min(int(yi / 8), gl.shape[0] - 1), min(int(xi / 8), gl.shape[1] - 1)]), 0.0)
            a = (li ** 1.8) * zi * 2.2
            if a < 0.01:
                continue
            rr = 0.8 + 3.2 * zi ** 3
            a = a / (1 + 0.5 * zi ** 3)
            cx, cy = xi / 2, yi / 2
            x0, x1 = int(max(cx - 3 * rr, 0)), int(min(cx + 3 * rr + 1, w // 2))
            y0, y1 = int(max(cy - 3 * rr, 0)), int(min(cy + 3 * rr + 1, h // 2))
            if x1 <= x0 or y1 <= y0:
                continue
            yy, xx = np.mgrid[y0:y1, x0:x1]
            lay[y0:y1, x0:x1] += a * np.exp(-((xx - cx) ** 2 + (yy - cy) ** 2) / (2 * rr * rr))
        lay = cv2.resize(lay, (w, h), interpolation=cv2.INTER_LINEAR)
        return lay[..., None] * amount


DUST = Dust(7, 120)


def haze_field(t, seed=3):
    r = np.random.default_rng(seed)
    base = r.random((12, 26)).astype(np.float32)
    base2 = r.random((6, 13)).astype(np.float32)
    a = cv2.resize(base, (AW + 400, AH), interpolation=cv2.INTER_CUBIC)
    b = cv2.resize(base2, (AW + 400, AH), interpolation=cv2.INTER_CUBIC)
    off1 = int(t * 9) % 400; off2 = int(t * 4) % 400
    return (a[:, off1:off1 + AW] * 0.6 + b[:, 400 - off2 - 1: 400 - off2 - 1 + AW] * 0.4)


def vignette(strength=0.35):
    v = radial(AH, AW, AW / 2, AH / 2, AW * 0.78, AH * 1.05, 1.0)
    return (1 - strength + strength * np.clip(v * 1.6, 0, 1))[..., None]


VIG = {}


def vig(s):
    if s not in VIG:
        VIG[s] = vignette(s)
    return VIG[s]


def leak(t, seed):
    """warm light leak for memories"""
    r = np.random.default_rng(seed)
    cx = AW * (0.1 + 0.8 * r.random()) + 160 * math.sin(t * 0.9 + seed)
    cy = AH * (0.2 + 0.6 * r.random())
    m = radial(AH, AW, cx, cy, AW * 0.55, AH * 0.9, 2.0)
    return m[..., None] * np.array((1.0, 0.55, 0.22), np.float32)


def place(plate, cx, cy, s):
    img, (ox, oy) = plate
    return np.clip(warp(img, cx - ox, cy - oy, s), 0, 1)

# ---------------------------------------------------------------- shots
# Each returns the active picture (AH x AW sRGB float) for absolute time t.


def black(t):
    return np.zeros((AH, AW, 3), np.float32)


def s1b(t):
    u = ease((t - 3.0) / 7.0)
    img = place(p_window(), 828, lerp(1236, 1262, u), lerp(1.62, 2.05, u))
    img = img + DUST.render(t, lum(img), 0.55) * np.array((0.8, 0.9, 1.0), np.float32)
    img = img + haze_field(t)[..., None] * lum(blur(img, 60))[..., None] * 0.45 * np.array(MOON, np.float32)
    return img * ease((t - 3.0) / 2.2)


def s2a(t):
    u = ease((t - 10.0) / 4.0)
    img = place(p_pendant_off(), lerp(916, 930, u), lerp(660, 850, u), lerp(1.80, 1.92, u))
    img = img + DUST.render(t + 20, lum(img) * 1.3, 0.6) * np.array((0.85, 0.92, 1.0), np.float32)
    return img


def s2b(t):
    u = ease((t - 14.0) / 4.5)
    cx, cy, s = lerp(690, 760, u), 575, lerp(1.40, 1.46, u)
    on = 1.0
    if t >= 18.0:
        k = int((t - 18.0) * FPS)
        on = [0.0, 0.0, 0.55, 0.0][k] if k < 4 else 0.0
    a = place(p_majlis_on(), cx, cy, s)
    if on >= 1.0:
        return a
    b = place(p_majlis_off(), cx, cy, s)
    return a * on + b * (1 - on)


def s2c(t):
    u = ease((t - 18.5) / 5.5)
    img = place(p_silhouette(), 838, lerp(1226, 1214, u), lerp(1.66, 1.84, u))
    img = img + DUST.render(t + 40, lum(img), 0.45) * np.array((0.8, 0.9, 1.0), np.float32)
    img = img + haze_field(t, 5)[..., None] * lum(blur(img, 70))[..., None] * 0.35 * np.array(MOON, np.float32)
    return img * ease((t - 18.5) / 0.8)


def memory(t, plate, t0, dur, c0, c1, seed):
    u = ease((t - t0) / dur)
    img = place(plate, lerp(c0[0], c1[0], u), lerp(c0[1], c1[1], u), lerp(c0[2], c1[2], u))
    fl = 1 + 0.035 * math.sin(t * 37.0 + seed) + 0.025 * math.sin(t * 13.3 + seed * 2)
    img = img * fl + leak(t, seed) * 0.16
    img = 0.065 * np.array((1.0, 0.9, 0.78), np.float32) + img * 0.935
    return np.clip(img, 0, 1)


def s3a(t):
    return memory(t, p_mem10(), 24.0, 4.0, (724, 790, 1.325), (735, 760, 1.46), 1)


FLASHES = [  # start, plate, cam0, cam1
    (28.00, p_mem02, (830, 1215, 1.70), (830, 1205, 1.82)),
    (29.25, p_mem08, (640, 1380, 0.47), (640, 1400, 0.52)),
    (30.50, p_mem11, (724, 1150, 1.325), (724, 1120, 1.40)),
    (31.75, p_mem03, (724, 1160, 1.325), (724, 1150, 1.38)),
]


def s3b(t):
    i = min(int((t - 28.0) / 1.25), 3)
    st, pl, c0, c1 = FLASHES[i]
    return memory(t, pl(), st, 1.25, c0, c1, 3 + i)


def s3c(t):
    u = ease((t - 33.0) / 6.0)
    return place(p_profile_ear(), lerp(724, 805, u), lerp(1500, 1520, u), lerp(1.325, 1.5, u))


def s4a(t):
    u = ease((t - 39.0) / 4.0)
    img = place(p_profile_walk(), lerp(830, 760, u), 1236, lerp(1.66, 1.72, u))
    img = img + DUST.render(t + 60, lum(img), 0.4) * np.array((0.9, 0.9, 1.0), np.float32)
    return img


def lamp_level(t):
    if t < 43.5:
        return 0.0
    k = int((t - 43.5) * FPS)
    seq = [0.35, 0.0, 0.0, 0.7, 0.2, 0.9]
    if k < len(seq):
        return seq[k]
    return min(1.0, 0.9 + (t - 43.5 - len(seq) / FPS) * 0.6)


def s4b(t):
    u = ease((t - 43.0) / 4.0)
    cx, cy, s = lerp(935, 958, u), lerp(842, 858, u), lerp(1.9, 2.15, u)
    a = place(p_pendant_off(), cx, cy, s)
    lv = lamp_level(t)
    if lv > 0:
        b = place(p_pendant_on(), cx, cy, s)
        a = a * (1 - lv) + b * lv
    a = a + DUST.render(t + 80, lum(a) * 1.2, 0.55) * np.array((1.0, 0.85, 0.65), np.float32)
    return a


def s4c(t):
    u = ease((t - 47.0) / 6.0)
    img = place(p_profile_up(), lerp(724, 640, u), lerp(1430, 1352, u), lerp(1.325, 1.75, u))
    return img * (1 - ease((t - 52.0) / 1.0))


def s5b(t):
    u = ease((t - 55.5) / 5.5)
    cx, cy, s = 724, lerp(1350, 1310, u), lerp(0.383, 0.70, u)
    d = place(p_face_dark(), cx, cy, s)
    l = place(p_face_lit(), cx, cy, s)
    # light sweeps across the face from the left
    k = ease((t - 56.6) / 2.6)
    edge = lerp(-0.25, 1.35, k)
    xx = np.linspace(0, 1, AW, dtype=np.float32)[None, :, None]
    m = smooth(edge + 0.18, edge - 0.18, xx)
    img = d * (1 - m) + l * m
    return img * ease((t - 55.5) / 0.5)


def s5c(t):
    u = ease((t - 61.0) / 7.0)
    img = place(p_fullbody(), 758, lerp(1645, 1500, u), lerp(0.4346, 0.70, u))
    img = img + DUST.render(t + 100, lum(img), 0.5) * np.array((0.85, 0.9, 1.0), np.float32)
    img = img + haze_field(t, 9)[..., None] * lum(blur(img, 70))[..., None] * 0.3 * np.array(MOON, np.float32)
    return img


def s6a(t):
    u = ease((t - 68.0) / 5.0)
    return place(p_present10(), lerp(724, 745, u), lerp(772, 742, u), lerp(1.325, 1.6, u))


_REC_FONT = None


def s6b(t):
    global _REC_FONT
    j = 1.6 * math.sin(t * 2.1) + 1.0 * math.sin(t * 3.7 + 1)
    k = 1.2 * math.sin(t * 1.7 + 2)
    img = place(p_rec(), 830 + j, 1222 + k, 1.70)
    if _REC_FONT is None:
        _REC_FONT = (ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf', 30),
                     ImageFont.truetype(f'{WORK}/fonts/IBMPlexSansArabic-SemiBold.ttf', 30))
    mono, sans = _REC_FONT
    ov = Image.new('RGBA', (AW, AH), (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    wht = (255, 255, 255, 190)
    m, L = 70, 70
    for (x, y, sx, sy) in [(m, m, 1, 1), (AW - m, m, -1, 1), (m, AH - m, 1, -1), (AW - m, AH - m, -1, -1)]:
        d.line([(x, y), (x + sx * L, y)], fill=wht, width=3)
        d.line([(x, y), (x, y + sy * L)], fill=wht, width=3)
    rec_on = t >= 73.5
    if rec_on and ((t - 73.5) % 1.0) < 0.6:
        d.ellipse([m + 30, m + 28, m + 52, m + 50], fill=(235, 40, 40, 235))
    d.text((m + 64, m + 22), 'REC' if rec_on else 'STBY', font=sans, fill=wht)
    fr = max(0, int((t - 73.5) * FPS)) if rec_on else 0
    tc = f'00:00:{fr // FPS:02d}:{fr % FPS:02d}'
    tw = d.textlength(tc, font=mono)
    d.text((AW - m - 30 - tw, m + 22), tc, font=mono, fill=wht)
    d.text((m + 30, AH - m - 56), '4K  24P', font=sans, fill=(255, 255, 255, 150))
    # centre cross
    c = (AW // 2, AH // 2)
    d.line([(c[0] - 14, c[1]), (c[0] + 14, c[1])], fill=(255, 255, 255, 110), width=2)
    d.line([(c[0], c[1] - 14), (c[0], c[1] + 14)], fill=(255, 255, 255, 110), width=2)
    o = np.asarray(ov).astype(np.float32) / 255
    a = o[..., 3:4]
    return img * (1 - a) + o[..., :3] * a


def s6c(t):
    u = ease((t - 77.0) / 5.0)
    return place(p_smile(), 640, lerp(1395, 1455, u), lerp(0.45, 0.62, u))


def s7(t):
    g = p_gobo()
    gh, gw = g.shape
    fade = ease((t - 82.4) / 1.2) * (1 - ease((t - 87.6) / 1.9))
    if fade <= 0:
        return black(t)
    s = 1.35
    tw, th = int(gw * s), int(gh * s)
    gg = cv2.resize(g, (tw, th), interpolation=cv2.INTER_LINEAR)
    lay = np.zeros((AH, AW), np.float32)
    x = int(AW / 2 - tw / 2 - 260 + (t - 82.0) * 55)
    y = (AH - th) // 2
    xs0, xs1 = max(x, 0), min(x + tw, AW)
    if xs1 > xs0:
        lay[y:y + th, xs0:xs1] = gg[:, xs0 - x:xs1 - x]
    lay = blur(lay, 14)
    hz = haze_field(t, 11)
    img = (lay * (0.35 + 0.65 * hz) * 0.16)[..., None] * np.array((1.0, 0.86, 0.68), np.float32)
    img = img + (hz * 0.035)[..., None] * np.array((0.7, 0.75, 0.85), np.float32)
    img = img * radial(AH, AW, AW / 2, AH / 2, AW * 0.6, AH * 0.9, 1.2)[..., None]
    img = img + DUST.render(t + 120, lum(img) * 6, 0.35) * np.array((1.0, 0.9, 0.75), np.float32)
    return img * fade


SHOTS = [
    (0.0, 3.0, black, 0.0), (3.0, 10.0, s1b, 0.45), (10.0, 14.0, s2a, 0.45), (14.0, 18.5, s2b, 0.4),
    (18.5, 24.0, s2c, 0.45), (24.0, 28.0, s3a, 0.3), (28.0, 33.0, s3b, 0.3), (33.0, 39.0, s3c, 0.4),
    (39.0, 43.0, s4a, 0.45), (43.0, 47.0, s4b, 0.4), (47.0, 53.0, s4c, 0.4), (53.0, 55.5, black, 0.0),
    (55.5, 61.0, s5b, 0.35), (61.0, 68.0, s5c, 0.45), (68.0, 73.0, s6a, 0.35), (73.0, 77.0, s6b, 0.2),
    (77.0, 82.0, s6c, 0.35), (82.0, 90.01, s7, 0.0),
]
# dissolves centred on a cut: time -> duration
DISSOLVES = {24.0: 0.5, 33.0: 0.5, 47.0: 0.4}
# warm flashes: centre -> (duration, strength)
FLASH = {24.0: (0.35, 0.55), 28.0: (0.16, 0.85), 29.25: (0.16, 0.85), 30.5: (0.16, 0.85), 31.75: (0.16, 0.85)}


def shot_at(t):
    for i, (a, b, fn, v) in enumerate(SHOTS):
        if a <= t < b:
            return i
    return len(SHOTS) - 1


def render_shot(i, t):
    a, b, fn, v = SHOTS[i]
    img = fn(t)
    if v > 0:
        img = img * vig(v)
    return img


def active(t):
    i = shot_at(t)
    img = render_shot(i, t)
    a, b, _, _ = SHOTS[i]
    for c, d in DISSOLVES.items():
        if abs(t - c) < d / 2:
            k = ease((t - (c - d / 2)) / d)
            if t < c and i + 1 < len(SHOTS):
                img = img * (1 - k) + render_shot(i + 1, t) * k
            elif t >= c and i > 0:
                img = render_shot(i - 1, t) * (1 - k) + img * k
    for c, (d, st) in FLASH.items():
        if abs(t - c) < d / 2:
            k = 1 - abs(t - c) / (d / 2)
            img = img + (k ** 1.5 * st) * np.array((1.0, 0.86, 0.66), np.float32)
    return np.clip(img, 0, 1)


def grain(img, n):
    r = np.random.default_rng(1000 + n)
    g = r.standard_normal((AH, AW)).astype(np.float32)
    g = cv2.GaussianBlur(g, (0, 0), 0.65)
    L = lum(img)
    amp = 0.016 + 0.05 * np.sqrt(np.clip(L, 0, 1)) * (1 - L)
    c = r.standard_normal((AH // 2, AW // 2, 3)).astype(np.float32)
    c = cv2.resize(c, (AW, AH), interpolation=cv2.INTER_LINEAR) * 0.005
    return np.clip(img + g[..., None] * amp[..., None] + c, 0, 1)


def frame(n):
    t = n / FPS
    img = grain(active(t), n)
    out = np.zeros((FH, FW, 3), np.float32)
    out[BAR:BAR + AH] = np.nan_to_num(img, nan=0.0)
    return (np.clip(out, 0, 1) * 255 + 0.5).astype(np.uint8)


def render_range(n0, n1, path):
    p = subprocess.Popen(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24',
                          '-s', f'{FW}x{FH}', '-r', str(FPS), '-i', '-', '-c:v', 'ffv1', '-level', '3',
                          '-pix_fmt', 'yuv444p', path], stdin=subprocess.PIPE)
    for n in range(n0, n1):
        p.stdin.write(frame(n).tobytes())
    p.stdin.close()
    p.wait()
    return path


if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'stills':
        ts = [float(x) for x in sys.argv[2].split(',')]
        out = sys.argv[3]
        tiles = []
        for t in ts:
            f = frame(int(round(t * FPS)))
            im = Image.fromarray(f).resize((640, 360))
            ImageDraw.Draw(im).text((8, 4), f'{t:.2f}', fill=(0, 255, 0))
            tiles.append(im)
        cols = 3
        rows = (len(tiles) + cols - 1) // cols
        sheet = Image.new('RGB', (cols * 644, rows * 364), (40, 40, 40))
        for k, im in enumerate(tiles):
            sheet.paste(im, ((k % cols) * 644, (k // cols) * 364))
        sheet.save(out, quality=90)
    elif cmd == 'one':
        t = float(sys.argv[2])
        Image.fromarray(frame(int(round(t * FPS)))).save(sys.argv[3], quality=92)
    elif cmd == 'range':
        render_range(int(sys.argv[2]), int(sys.argv[3]), sys.argv[4])
