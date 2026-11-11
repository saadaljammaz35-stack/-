"""Packs the site's own captures into one 3×3 texture atlas for the gallery cards.
Each 16:10 tile has a 12 px gutter of repeated edge pixels so mipmaps never bleed.

    python tools/atlas.py ../assets atlas.webp
"""
import sys
from PIL import Image

TILES = ['card-3d.webp', 'card-mubayn.webp', 'card-labina.webp', 'card-clinibot.webp', 'card-identity.webp',
         'medad-hero.png', 'medad-services.png', 'medad-work.png', 'medad-process.png']
TW, TH, G = 640, 400, 12


def fit(im, w, h):
    im = im.convert('RGB')
    s = max(w / im.width, h / im.height)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    x, y = (im.width - w) // 2, (im.height - h) // 2
    return im.crop((x, y, x + w, y + h))


def main(src, out):
    atlas = Image.new('RGB', (TW * 3, TH * 3))
    for i, name in enumerate(TILES):
        inner = fit(Image.open(f'{src}/{name}'), TW - 2 * G, TH - 2 * G)
        tile = inner.resize((TW, TH), Image.NEAREST)          # placeholder, overwritten below
        tile.paste(inner.resize((TW, TH)), (0, 0))
        # gutter: stretch edge rows/columns outward
        tile.paste(inner, (G, G))
        tile.paste(inner.crop((0, 0, 1, inner.height)).resize((G, inner.height)), (0, G))
        tile.paste(inner.crop((inner.width - 1, 0, inner.width, inner.height)).resize((G, inner.height)), (TW - G, G))
        top = tile.crop((0, G, TW, G + 1)).resize((TW, G)); tile.paste(top, (0, 0))
        bot = tile.crop((0, TH - G - 1, TW, TH - G)).resize((TW, G)); tile.paste(bot, (0, TH - G))
        atlas.paste(tile, ((i % 3) * TW, (i // 3) * TH))
    atlas.save(out, quality=86, method=6)
    print(out, atlas.size)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
