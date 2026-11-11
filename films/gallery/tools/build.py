"""Inlines paths.js, glyphs.js and the card atlas into one self-contained page.

    python tools/build.py        → medad-gallery.html (three.js still loads from the CDN)
"""
import base64
import pathlib
import re

HERE = pathlib.Path(__file__).resolve().parent.parent
src = (HERE / 'index.html').read_text()


def inline(m):
    name = m.group(1)
    return '<script>\n' + (HERE / name).read_text() + '\n</script>'


out = re.sub(r'<!--INLINE:([\w.]+)-->.*?<!--/INLINE-->', inline, src, flags=re.S)
atlas = base64.b64encode((HERE / 'atlas.webp').read_bytes()).decode()
out = out.replace("window.ATLAS_SRC = 'atlas.webp'; /*ATLAS*/", f"window.ATLAS_SRC = 'data:image/webp;base64,{atlas}';")
assert 'atlas.webp' not in out and 'src="paths.js"' not in out and 'src="glyphs.js"' not in out
(HERE / 'medad-gallery.html').write_text(out)
print('medad-gallery.html', round(len(out) / 1024), 'KB')
