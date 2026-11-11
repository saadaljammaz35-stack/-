# MEDAD films

Two code-built films for مِداد. Each page computes every frame from time, so
it can be captured with Playwright and encoded with ffmpeg.

## gallery/: the 3D gallery (three.js, 20 s)

Cards on walls that, seen from above, spell MEDAD. There are six shots:
- rack focus
- dolly back with a blue wave
- crane over the wall
- a card swinging out with the request lifting off as 3D Arabic type
- the pull back while blue ink writes the word
- the settle on the logo

- `medad-gallery.html`: the self-contained page (three.js loads from the CDN). Open it to preview; add `?render` to drive it from `window.seek(t)`.
- `index.html`: the source. `python3 tools/build.py` inlines `paths.js`, `glyphs.js` and `atlas.webp` into `medad-gallery.html`.
- `tools/glyphs.py`: shapes the Arabic lines with HarfBuzz and writes their outlines to `glyphs.js`.
- `tools/atlas.py`: packs the site's own captures into the card atlas.
- `render.js`: `PAGE=medad-gallery.html node render.js film <dir> 60`. Then encode with:

      ffmpeg -framerate 60 -i <dir>/f%05d.jpg -c:v libx264 -crf 16 -pix_fmt yuv420p out.mp4

## chat/: «أبي موقع ثلاثي الأبعاد» (2D, 130 BPM, 32 beats)

- `index.html`: `seek(t)` sets every style from time.
- `render.js`:
  - `node render.js stills <dir> 1.8 7.25 …` renders stills at those times.
  - `node render.js film <dir> 8` renders 60 fps × 8 sub-frames for tmix motion blur.
- `audio.py`: music and effects composed in code, mastered to −14 LUFS.

Fonts are IBM Plex Sans Arabic, Geist and Noto Naskh Arabic (OFL, licences in `fonts/`).
