import os
import numpy as np, cv2
FW, FH = 1920, 1080          # output frame
AW, AH = 1920, 804           # active picture inside 2.39:1 letterbox
BAR = (FH - AH) // 2
FPS = 24
SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'src')

def load(p):
    im = cv2.imread(f'{SRC}/p{p}.jpg', cv2.IMREAD_COLOR)[:, :, ::-1]
    return im.astype(np.float32) / 255.0

def s2l(x):
    return np.where(x <= 0.04045, x / 12.92, ((x + 0.055) / 1.055) ** 2.4).astype(np.float32)

def l2s(x):
    x = np.clip(x, 0, 1)
    return np.where(x <= 0.0031308, x * 12.92, 1.055 * np.power(x, 1 / 2.4) - 0.055).astype(np.float32)

def aces(x):
    x = np.maximum(x, 0)
    return np.clip((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0, 1)

def lum(x):
    return x[..., 0] * 0.2126 + x[..., 1] * 0.7152 + x[..., 2] * 0.0722

def smooth(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)

def blur(x, sigma):
    if sigma <= 0:
        return x
    # blur big kernels at reduced resolution for speed
    if sigma > 12:
        f = int(sigma // 6)
        h, w = x.shape[:2]
        small = cv2.resize(x, (max(1, w // f), max(1, h // f)), interpolation=cv2.INTER_AREA)
        small = cv2.GaussianBlur(small, (0, 0), sigma / f)
        return cv2.resize(small, (w, h), interpolation=cv2.INTER_LINEAR)
    return cv2.GaussianBlur(x, (0, 0), sigma)

def radial(h, w, cx, cy, rx, ry, power=2.0):
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    d = np.sqrt(((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2)
    return np.clip(1 - d, 0, 1) ** power

def finish(lin, wb=(1, 1, 1), sat=1.0, shadow_tint=(0, 0, 0), high_tint=(0, 0, 0), black=0.0, contrast=1.0):
    """linear scene -> graded sRGB (0..1)"""
    lin = lin * np.array(wb, np.float32)
    s = l2s(aces(lin * 1.0))
    L = lum(s)[..., None]
    if contrast != 1.0:
        s = np.clip(0.5 + (s - 0.5) * contrast, 0, 1)
        L = lum(s)[..., None]
    s = L + (s - L) * sat
    s = s + np.array(shadow_tint, np.float32) * (1 - L) ** 2 + np.array(high_tint, np.float32) * L ** 2
    s = black + s * (1 - black)
    return np.clip(s, 0, 1).astype(np.float32)

def warp(img, cx, cy, s, w=AW, h=AH, interp=cv2.INTER_CUBIC):
    """output pixel (u,v) samples source (cx + (u-w/2)/s, cy + (v-h/2)/s)"""
    M = np.float32([[1 / s, 0, cx - (w / 2) / s], [0, 1 / s, cy - (h / 2) / s]])
    return cv2.warpAffine(img, M, (w, h), flags=interp | cv2.WARP_INVERSE_MAP,
                          borderMode=cv2.BORDER_CONSTANT, borderValue=0)

def ease(t):
    t = min(max(t, 0.0), 1.0)
    return t * t * (3 - 2 * t)

def ease_out(t):
    t = min(max(t, 0.0), 1.0)
    return 1 - (1 - t) ** 3

def lerp(a, b, t):
    return a + (b - a) * t
