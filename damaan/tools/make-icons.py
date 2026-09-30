"""
Renders every launcher asset from one vector source.

The design came out of the AI image generation step (a white shield holding a
receipt on an indigo-to-violet gradient); this script reproduces it as vector so
the shipped 1024pt icon is mathematically crisp, uses the exact brand colour
from src/theme/tokens.ts, and carries no JPEG artefacts. Re-run after any tweak:

    python3 tools/make-icons.py
"""

import io
import os

import cairosvg
from PIL import Image

BRAND_FROM = "#5856D6"
BRAND_TO = "#7B5AE0"
ASSETS = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets")

# Shield outline, drawn in a 100x100 box.
SHIELD = "M50 9 L87 22 C87 54 73 79 50 91 C27 79 13 54 13 22 Z"


def receipt_path() -> str:
    """A receipt with rounded top corners and a torn zigzag bottom edge."""
    left, right, top = 34.0, 66.0, 31.0
    low, high = 61.0, 57.2
    radius = 3.0

    steps = 12
    width = right - left
    zigzag = []
    for index in range(1, steps + 1):
        x = right - (width / steps) * index
        zigzag.append(f"L{x:.2f} {(high if index % 2 else low):.2f}")

    return (
        f"M{left} {top + radius} "
        f"Q{left} {top} {left + radius} {top} "
        f"H{right - radius} Q{right} {top} {right} {top + radius} "
        f"V{low} " + " ".join(zigzag) + " Z"
    )


def symbol(color: str, line_color: str | None) -> str:
    """The shield-and-receipt mark. `line_color` draws the two text lines."""
    lines = ""
    if line_color:
        lines = (
            f'<rect x="39.5" y="38" width="21" height="3.4" rx="1.7" fill="{line_color}"/>'
            f'<rect x="39.5" y="45.5" width="13" height="3.4" rx="1.7" fill="{line_color}"/>'
        )

    return (
        f'<path d="{SHIELD}" fill="none" stroke="{color}" stroke-width="7.2" '
        f'stroke-linejoin="round" stroke-linecap="round"/>'
        f'<path d="{receipt_path()}" fill="{color}"/>'
        f"{lines}"
    )


def full_icon() -> str:
    """The App Store icon: full-bleed gradient, no transparency, no rounding."""
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="{BRAND_FROM}"/>
      <stop offset="1" stop-color="{BRAND_TO}"/>
    </linearGradient>
  </defs>
  <rect width="100" height="100" fill="url(#bg)"/>
  {symbol("#FFFFFF", "#6B5ADB")}
</svg>"""


def bare_symbol(color: str, line_color: str, scale: float) -> str:
    """The mark alone on transparency, inset so it clears Android's safe zone."""
    offset = (100 - 100 * scale) / 2
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <g transform="translate({offset:.2f} {offset:.2f}) scale({scale})">
    {symbol(color, line_color)}
  </g>
</svg>"""


def gradient_only() -> str:
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="{BRAND_FROM}"/>
      <stop offset="1" stop-color="{BRAND_TO}"/>
    </linearGradient>
  </defs>
  <rect width="100" height="100" fill="url(#bg)"/>
</svg>"""


def render(svg: str, name: str, size: int, *, opaque: bool) -> None:
    png = cairosvg.svg2png(bytestring=svg.encode(), output_width=size, output_height=size)
    image = Image.open(io.BytesIO(png)).convert("RGBA")

    if opaque:
        # App Store icons are rejected when they carry an alpha channel.
        flattened = Image.new("RGB", image.size, BRAND_FROM)
        flattened.paste(image, mask=image.split()[3])
        image = flattened

    path = os.path.join(ASSETS, name)
    image.save(path, "PNG", optimize=True)
    print(f"{name:34} {size}x{size}  {os.path.getsize(path) / 1024:.1f} KB")


def main() -> None:
    os.makedirs(ASSETS, exist_ok=True)

    render(full_icon(), "icon.png", 1024, opaque=True)
    render(full_icon(), "favicon.png", 96, opaque=True)
    # The splash sits on a light or black background, so the mark is tinted.
    render(bare_symbol(BRAND_FROM, "#FFFFFF", 0.92), "splash-icon.png", 512, opaque=False)
    render(bare_symbol("#FFFFFF", "#6B5ADB", 0.62), "android-icon-foreground.png", 432, opaque=False)
    render(gradient_only(), "android-icon-background.png", 432, opaque=True)
    render(bare_symbol("#000000", "#FFFFFF", 0.62), "android-icon-monochrome.png", 432, opaque=False)


if __name__ == "__main__":
    main()
