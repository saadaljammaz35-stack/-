#!/usr/bin/env python3
"""Draws the game icon (512x512) and thumbnail (1920x1080) for the Roblox game page.

All artwork is generated procedurally (original). Output goes to assets/images/.
    python3 tools/make_images.py
"""
import math
import os
import random

from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "images")
FONTS = [
    "/usr/share/fonts/opentype/inter/InterDisplay-Black.otf",
    "/usr/share/fonts/opentype/inter/InterDisplay-Bold.otf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
]
ORANGE = (255, 122, 26)


def font(size):
    for f in FONTS:
        if os.path.exists(f):
            return ImageFont.truetype(f, size)
    return ImageFont.load_default()


def starfield(w, h, n, seed=3):
    r = random.Random(seed)
    img = Image.new("RGB", (w, h), (5, 7, 14))
    d = ImageDraw.Draw(img)
    for _ in range(n):
        x, y = r.randrange(w), r.randrange(h)
        s = r.choice([1, 1, 1, 2, 2, 3])
        c = r.choice([(255, 255, 255), (200, 215, 255), (255, 230, 200)])
        d.ellipse([x, y, x + s, y + s], fill=c)
    return img


def moon(size, clean_frac, seed=7):
    """Moon disc: dusty grey on one side, freshly cleaned white on the other, with craters."""
    r = random.Random(seed)
    m = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(m)
    d.ellipse([0, 0, size - 1, size - 1], fill=(118, 112, 106, 255))
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, size - 1, size - 1], fill=255)
    clean = Image.new("RGBA", (size, size), (232, 234, 238, 255))
    cut = Image.new("L", (size, size), 0)
    ImageDraw.Draw(cut).rectangle([0, 0, int(size * clean_frac), size], fill=255)
    m.paste(clean, (0, 0), Image.composite(cut, Image.new("L", (size, size), 0), mask))
    for _ in range(26):
        cr = r.randint(size // 40, size // 9)
        cx, cy = r.randint(cr, size - cr), r.randint(cr, size - cr)
        if (cx - size / 2) ** 2 + (cy - size / 2) ** 2 < (size / 2 - cr) ** 2:
            shade = (90, 86, 82, 255) if cx > size * clean_frac else (205, 208, 214, 255)
            d.ellipse([cx - cr, cy - cr, cx + cr, cy + cr], fill=shade)
            d.ellipse([cx - cr * 0.8, cy - cr * 0.8, cx + cr * 0.75, cy + cr * 0.75], fill=tuple(min(255, v + 18) for v in shade[:3]) + (255,))
    # brush line between dusty and clean
    x = int(size * clean_frac)
    d.line([x, size * 0.08, x, size * 0.92], fill=ORANGE + (255,), width=max(3, size // 120))
    m.putalpha(mask)
    # soft glow on a padded canvas so the blur is never clipped by the image bounds
    pad = size // 6
    glow = Image.new("RGBA", (size + pad * 2, size + pad * 2), (0, 0, 0, 0))
    halo = Image.new("RGBA", (size, size), (220, 225, 240, 140))
    halo.putalpha(mask.point(lambda v: v * 140 // 255))
    glow.paste(halo, (pad, pad), halo)
    glow = glow.filter(ImageFilter.GaussianBlur(size // 18))
    return m, glow, pad


def astronaut(scale):
    """Simple stylised astronaut holding a push broom."""
    w, h = int(220 * scale), int(300 * scale)
    a = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(a)
    s = scale
    white = (240, 242, 246, 255)
    d.rounded_rectangle([60 * s, 110 * s, 150 * s, 220 * s], 24 * s, fill=white)  # torso
    d.rounded_rectangle([140 * s, 115 * s, 185 * s, 205 * s], 14 * s, fill=ORANGE + (255,))  # container
    d.ellipse([55 * s, 30 * s, 155 * s, 125 * s], fill=white)  # helmet
    d.ellipse([72 * s, 52 * s, 140 * s, 108 * s], fill=(255, 190, 70, 255))  # visor
    d.ellipse([84 * s, 60 * s, 104 * s, 76 * s], fill=(255, 235, 180, 255))
    d.rounded_rectangle([68 * s, 210 * s, 98 * s, 285 * s], 12 * s, fill=white)  # legs
    d.rounded_rectangle([112 * s, 210 * s, 142 * s, 285 * s], 12 * s, fill=white)
    d.line([40 * s, 140 * s, 10 * s, 280 * s], fill=(60, 60, 70, 255), width=int(9 * s))  # broom shaft
    d.rounded_rectangle([-20 * s, 270 * s, 45 * s, 292 * s], 6 * s, fill=ORANGE + (255,))  # broom head
    d.rounded_rectangle([50 * s, 125 * s, 75 * s, 175 * s], 10 * s, fill=white)  # arm
    return a


def icon():
    size = 512
    img = starfield(size, size, 160)
    m, glow, pad = moon(360, 0.5)
    img.paste(glow, (40 - pad, 40 - pad), glow)
    img.paste(m, (40, 40), m)
    a = astronaut(0.82)
    img.paste(a, (318, 150), a)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([20, 420, 492, 496], 18, fill=(20, 22, 30))
    f = font(58)
    text = "LUNAR SWEEP"
    tw = d.textlength(text, font=f)
    d.text(((size - tw) / 2, 426), text, font=f, fill=ORANGE)
    img.save(os.path.join(OUT, "icon_512.png"))


def thumbnail():
    w, h = 1920, 1080
    img = starfield(w, h, 900, seed=11)
    m, glow, pad = moon(820, 0.55)
    img.paste(glow, (1000 - pad, 140 - pad), glow)
    img.paste(m, (1000, 140), m)
    # earth
    d = ImageDraw.Draw(img)
    d.ellipse([140, 120, 300, 280], fill=(40, 90, 200))
    d.ellipse([170, 150, 240, 210], fill=(60, 150, 80))
    d.ellipse([220, 200, 280, 250], fill=(60, 150, 80))
    a = astronaut(1.9)
    img.paste(a, (1480, 480), a)
    d.text((110, 380), "LUNAR", font=font(190), fill=(240, 242, 246))
    d.text((110, 570), "SWEEP", font=font(190), fill=ORANGE)
    d.text((118, 790), "Clean the moon. Build a base. Command robots.", font=font(46), fill=(185, 192, 206))
    d.rounded_rectangle([110, 880, 640, 960], 20, fill=ORANGE)
    d.text((140, 893), "9 ZONES • 17 ROBOTS", font=font(48), fill=(20, 22, 30))
    img.save(os.path.join(OUT, "thumbnail_1920x1080.png"))


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    icon()
    thumbnail()
    print("images written to", os.path.abspath(OUT))
