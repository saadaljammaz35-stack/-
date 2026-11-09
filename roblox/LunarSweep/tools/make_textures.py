#!/usr/bin/env python3
"""Turn raw generated ground photos into tileable terrain textures for Roblox MaterialVariants.

For every <name>.png in the input folder it writes, into assets/textures/:
  <name>_color.jpg   1024x1024 seamless colour map (neutral grey; the game tints it per zone)
  <name>_normal.jpg  1024x1024 tangent-space normal map (OpenGL / +Y up, what Roblox expects)

Usage: python3 tools/make_textures.py <raw_dir> [out_dir]
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

SIZE = 1024


def seamless(img: np.ndarray) -> np.ndarray:
    """Blend the image with a half-offset copy of itself so the borders wrap without seams."""
    h, w = img.shape[:2]
    rolled = np.roll(np.roll(img, h // 2, axis=0), w // 2, axis=1)
    y = np.abs(np.linspace(-1, 1, h))[:, None]
    x = np.abs(np.linspace(-1, 1, w))[None, :]
    # weight 1 near the borders (use the rolled copy, which is continuous there)
    edge = np.clip((np.maximum(x, y) - 0.55) / 0.4, 0, 1)
    edge = edge * edge * (3 - 2 * edge)
    return img * (1 - edge[..., None]) + rolled * edge[..., None]


def neutralise(img: np.ndarray) -> np.ndarray:
    """Remove any colour cast and flatten large-scale lighting so tiling is not obvious."""
    lum = img.mean(axis=2, keepdims=True)
    grey = img * 0.25 + lum * 0.75
    # divide out a heavily blurred copy (low-frequency shading), keep the detail
    small = Image.fromarray(np.clip(grey, 0, 255).astype(np.uint8)).resize((16, 16), Image.BILINEAR)
    low = np.asarray(small.resize((img.shape[1], img.shape[0]), Image.BICUBIC)).astype(np.float32)
    flat = grey / np.maximum(low, 1) * low.mean()
    return np.clip(flat, 0, 255)


def normal_map(color: np.ndarray, strength: float = 3.0) -> np.ndarray:
    height = color.mean(axis=2) / 255.0
    dx = (np.roll(height, -1, axis=1) - np.roll(height, 1, axis=1)) * 0.5
    dy = (np.roll(height, -1, axis=0) - np.roll(height, 1, axis=0)) * 0.5
    nx = -dx * strength
    ny = dy * strength  # +Y up (OpenGL)
    nz = np.ones_like(height)
    length = np.sqrt(nx * nx + ny * ny + nz * nz)
    n = np.stack([nx / length, ny / length, nz / length], axis=2)
    return np.clip((n * 0.5 + 0.5) * 255, 0, 255)


def main() -> None:
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    raw = Path(sys.argv[1])
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(__file__).resolve().parent.parent / "assets" / "textures"
    out.mkdir(parents=True, exist_ok=True)
    for src in sorted(raw.glob("*.png")):
        img = np.asarray(Image.open(src).convert("RGB").resize((SIZE, SIZE), Image.LANCZOS)).astype(np.float32)
        img = seamless(neutralise(img))
        Image.fromarray(img.astype(np.uint8)).save(out / f"{src.stem}_color.jpg", quality=92)
        Image.fromarray(normal_map(img).astype(np.uint8)).save(out / f"{src.stem}_normal.jpg", quality=95)
        print("wrote", src.stem)


if __name__ == "__main__":
    main()
