# CRUST Bakery — the website

A cinematic scroll site for CRUST Bakery, Riyadh. Plain HTML, CSS and vanilla JavaScript.
No frameworks, no build step, no npm.

```
crust-bakery/
  site/                 <- this folder IS the site; its contents are what gets deployed
    index.html
    assets/
      crust-box.jpg     the brand's real packaging photograph
      hero-poster.jpg   first frame of the hero film (placeholder until the film exists)
      hero-still.jpg    the designed still hero for phones (placeholder until the film exists)
  DESIGN-PACKAGE.md     every creative decision, written before the build
  README.md
```

## Previewing it

Serve the `site/` folder and open the address in a browser:

```
cd site && npx http-server      # or: python3 -m http.server
```

Opening `index.html` by double clicking shows the designed still hero instead of the scrolling
film, because browsers block `fetch` on `file://` URLs. That fallback is intentional and the
page is complete in it.

## What the page does

- A 500vh pinned hero whose sticky stage scrubs a six second film with the scroll, forward on
  the way down and backward on the way up. The film streams in as a Blob behind a progress ring,
  so the page works on hosts without HTTP Range support.
- Four caption bands, each with its own entrance, paced in scroll distance and validated by the
  flick test. Each band carries a four layer legibility system audited against the worst frame.
- A designed still hero for phones, portrait tablets, landscape phones and reduced motion. Those
  visitors never download the film or its poster. The five gates are matched character for
  character in the CSS and in the JavaScript, and they are re-evaluated live on rotation, resize
  and preference changes.
- Arabic and English in one page, Arabic first, with a switch in the bar. The choice is
  remembered per visitor.
- One interactive moment: press and hold to tie the knot.
- Every order button opens CRUST on The Chefz. There is no form, because ordering already
  happens there.

## Still to come

1. **The hero film.** Generating it needs a paid Higgsfield plan. The storyboard, the prompts
   and the costs are in `DESIGN-PACKAGE.md`. When the film exists, drop three files into
   `site/assets/` and nothing else changes:
   `hero-scrub.mp4`, `hero-poster.jpg`, `hero-still.jpg`.
   The byte size of the video goes in `VIDEO_BYTES` near the top of the script.
2. **The menu.** Names, prices and what comes in a box.
3. **The real delivery facts** for the FAQ: areas and hours.

## Before it goes live

Patch `og:image` and `og:url` with the live absolute URL at the `<!-- DEPLOY STEP -->` comment,
then zip the CONTENTS of `site/` (so `index.html` sits at the top of the zip) and deploy.
