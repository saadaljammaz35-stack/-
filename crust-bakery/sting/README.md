# CRUST — بابكا شوكولاتة · 12-second square sting

1080×1080. Frame numbers below are 29.97 fps (f0–f359); the master renders at
59.94, so `seek()` is called with half frames and every animated value is a
continuous function of the frame number.

```
./make.sh                            # 1080x1080 → build/crust-sting.mp4
./make.sh vert                       # 1080x1920 → build/crust-sting-9x16.mp4
node render.mjs out/ 40 86 150 230   # just those stills (add --vert for 9:16)
python3 -I audio.py bed-raw.wav      # just the audio bed
node probe.mjs                       # print the measured geometry
```

## Formats

`seek(f)` draws the same square composition in both; `setFormat('vert')` drops
that 1080 band into the middle of a 1080×1920 frame and lets every background
run full bleed, so the page, the sky and the black end card simply continue
past the band — no bars, and the action sits in the Reels/Stories safe area.
The brief's coordinates are untouched: the only vertical-only changes are to
the few things built to run off the square's bottom edge (the hub window, the
wallpaper, the room above the laptop, the S3 tint), which have to run off a
taller one too.

## Files

| file | what it is |
|---|---|
| `film.html` | the stage and every shot's markup |
| `film.js` | `seek(f)` — a pure function of the frame number |
| `audio.py` | the 12.075 s bed and SFX, synthesised from oscillators |
| `render.mjs` | Playwright: one screenshot per master frame |
| `make.sh` | the whole pipeline |
| `probe.mjs` | measures the fitted boxes, so the geometry can be checked |
| `art/` | covers cropped from the brand's own packaging photo |
| `fonts/` | Tajawal (Arabic) and Amiri (the serif wordmark) |

## Shot table

| | frames | |
|---|---|---|
| S1 | f0–71 | haze → header lockup → hub window → the cursor clicks the disc |
| S2 | f72–100 | app icon, four squares orbiting into a cross, then a row |
| S3 | f101–158 | menu bar, the frosted prompt box, typing, whip-tilt out |
| S4 | f159–186 | the product page scrolling into place |
| S5 | f187–214 | a card rises over it |
| S6 | f215–244 | two stacked cards with frosted-glass titles |
| S7 | f245–300 | the lone logo disc (the only hold: f269–287) |
| S8 | f301–359 | black end card, the wordmark collapsing |

The hard cuts at **f72, f101, f159** are exact. Nothing freezes except S7
f269–287. There are no crossfades and no `Math.random` — the few places that
need scatter use a seeded integer hash.

## Palette — CRUST's own colours in the brief's roles

| role | brief | here | from |
|---|---|---|---|
| page | `#FDFDFB` | `#FCF8F1` | their cream canvas |
| haze / ice | `#B7CFEB` / `#E6F0FA` | `#A8C0D8` / `#E4EFF8` | the logo's pinstripe blue |
| sky gradient | `#294376 → #769CC2` | `#3E5A86 → #A8C0D8` | their stripe blue |
| navy | `#1E2F52` | `#2A1710` | their cocoa ink |
| accent 1 / 2 | `#2F6BFF` / `#3CC8F0` | `#3E5A86` / `#A8C0D8` | |
| accent 3 | mint `#4ED6A0` | warm brown `#6B4A34` | their text-secondary |

No purple, violet, magenta or orange anywhere. The brand's caramel `#A97B41`
is warm enough to read as orange when it fills a shape, so it is kept to
hairlines and the third accent is their brown instead.

## Where this departs from the brief, and why

1. **Type.** The copy is Arabic, so Tajawal 400/500/700 carries it; Inter is
   still loaded for Latin. The end-card wordmark is **Amiri Bold, not Inter
   600** — CRUST's real wordmark is a thin letterspaced serif, and the end
   card is the brand's signature, so matching the logo wins over the spec.
2. **"on Whop" → "على ذا شفز".** CRUST sells through The Chefz; the pill says
   where the product actually is.
3. **Lockup scale 0.9916.** The Arabic name does not fit the span x474–1063 at
   the disc's full ⌀132, so the whole lockup is scaled to fit, exactly as the
   brief's gotcha says to. The disc lands at ⌀131 and its centre at x539.4.
4. **S4's cursor rest is measured, not hard-coded.** It stops at (502, 586)
   rather than the brief's ≈(450, 591), because it is placed from the key
   phrase's own measured box — so it is always under "طازة كل يوم" whatever
   the Arabic does to the line.
5. **S3's drift is t⁵, not t².** Either curve hits the brief's 25 px/frame at
   f158, but t² has the scene already moving 16 px/frame at f150 — the frame
   the brief asks to see the finished prompt in. t⁵ keeps f150 readable and
   still whips out.
6. **Menu-bar date at 32 px, not 34.** The Arabic date is wider than
   "Mon Jun 22  9:41 AM"; at 34 it collided with the third dot and the frame
   edge once the +125 px pan lands.
7. **S6's lower title auto-fits to 129.6 px.** "التوصيل" is wider than
   "العلبة"; both are scaled to the card rather than clipped.
8. **Length.** 720 master frames = 12.012 s of video; the audio is exactly the
   12.075 s the brief specifies, so its last 63 ms (inside the 60 ms fade)
   runs past the final frame.
9. **`Math.floor` appears once**, on the typing character index. That is a
   count, not motion; nothing that moves is quantised.

Not a departure, but worth recording: the first render of S5 had the card
lifting clear of the bottom edge late in the shot instead of running off it,
because the card was only as tall as its own content. It now carries 640 px of
white below the sub-caption, and the exit scale's origin moved from 40 % to
28 % so the shrink still reads from the cover.

## Measured, not assumed

`probe.mjs` prints the real boxes after the fonts have loaded:

```
lockup   474 … 1063        the brief's span, exactly
pill     919 … 1063        17 px inside the frame
glass    196 … 922,  568 … 797
cards    271 … 809,  top 168 / bottom 552, gap 36
titles   fit inside the cards at 150 px and 129.6 px
audio    -14.2 LUFS, true peak -1.1 dBFS in both delivered files
```

One trap worth recording: `document.fonts.ready` only waits for faces that
something has already asked for. Nothing had been laid out when `init()` ran,
so every fitted box was being measured against fallback metrics and came out
5–12 % wrong. `film.js` now calls `document.fonts.load()` for each face and
size before measuring anything.

## The covers

Cropped from the brand's own packaging photograph, never from stock, and
chosen so that **no crop contains text** — a cover with its own wordmark would
double up behind the frosted-glass titles in S6.
