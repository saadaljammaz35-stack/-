# @nabd/gallery

A standalone Next.js app hosting interactive component demos:

| Route | Component | File |
| --- | --- | --- |
| `/` | `MorphGallery`: a WebGL photo gallery whose slides dissolve into each other through fbm noise | `src/components/ui/morph-gallery.tsx` |
| `/rail` | `ClothingRailHero`, showing Sahm's cups: a rail you can brush, slide hooks along and lift pieces from | `src/components/ui/product-rail-gallery.tsx` |

## Why this is its own app

`apps/admin` styles itself with hand-written CSS (`src/app/globals.css`) and no
Tailwind. Tailwind's Preflight resets margins, list styles and `img` sizing, so
adding it there would quietly reflow the admin console. Keeping the gallery in
its own app lets Preflight stay on — which the thumbnail strip relies on — and
leaves the fintech planes untouched.

## Getting started

```bash
pnpm install          # from the repo root
pnpm --filter @nabd/gallery dev
```

Then open http://localhost:3003 (or http://localhost:3003/rail).

## Stack

| Piece | Choice |
| --- | --- |
| Framework | Next.js 15 (App Router) + React 19 |
| Styling | Tailwind CSS v4 — no `tailwind.config.js`; the theme lives in `@theme` inside `src/app/globals.css` |
| Components | shadcn structure, configured in `components.json`, resolving `@/components/ui` |
| Types | TypeScript, extending the repo's `tsconfig.base.json` (`strict`, `noUncheckedIndexedAccess`) |

Add further shadcn components the usual way; `components.json` and
`src/lib/utils.ts` are already in place:

```bash
pnpm --filter @nabd/gallery exec shadcn@latest add button
```

## Images must send CORS headers

An image served without `Access-Control-Allow-Origin` **cannot** be uploaded
into a WebGL texture. The component detects this and falls back to a DOM
cross-fade, so the gallery keeps working but stops morphing. The demo uses
`images.unsplash.com`, which sends `Access-Control-Allow-Origin: *`.

Two separate things must both allow a host:

1. the host itself must send the CORS header, and
2. `next.config.mjs` must list it under `img-src` in the Content-Security-Policy.

## MorphGallery props

| Prop | Default | Notes |
| --- | --- | --- |
| `items` | — | `{ src, thumb?, alt? }[]` |
| `height` | `100svh` | **Must be a definite length** — the canvas fills this box |
| `duration` | `1500` | Milliseconds of dissolve |
| `noiseScale` | `3.5` | Higher tears into finer shreds |
| `edge` | `0.15` | Width of the dissolve front; `0` is a hard edge |
| `drift` | `0.5` | How far the two frames slide against each other |
| `loop` | `true` | Wrap past the ends |
| `autoplay` | `0` | Milliseconds between advances; `0` is off |
| `arrows` / `thumbnails` | `true` | |
| `index` / `defaultIndex` / `onIndexChange` | — | Controlled or uncontrolled |

Respects `prefers-reduced-motion` (keeps the gallery, drops the animation) and
pauses on hover, focus and hidden tabs.

## Scripts need 'unsafe-inline' in the CSP

The App Router hydrates from inline `<script>` tags (the RSC payload pushed
through `self.__next_f`). The policy in `next.config.mjs` used to fall back to
`default-src 'self'` for scripts, which blocked them all: the HTML arrived, no
client component ever hydrated, and both demos rendered blank. `script-src` now
allows inline scripts, plus `'unsafe-eval'` in development only. A per-request
nonce from middleware is the stricter option if this app ever serves more than
demos.

## ClothingRailHero (`/rail`)

Garments hang on a rail and behave like cloth on hangers: brushing the rail
sets them swinging, hovering (or tapping) turns one to face you, dragging slides
a hanger along the rail and pushes its neighbours, and clicking lifts the piece
into a detail view where it can be turned to show its back. Below about 200px of
fitted garment height the rail becomes a swipeable carousel with dots.

The demo hangs Sahm's cups on it, not garments. `src/components/product-rail-gallery-demo.tsx`
holds the cups and is rendered by `src/app/rail/page.tsx`. It is a separate
module because a Next page may only export its component and route config;
exporting `CUP_ITEMS` from the page would break the build.

The page wears Sahm's palette and is right-to-left Arabic. The tokens are set in
`globals.css` on `:root:has([data-sahm])`, not on the page's wrapper, because the
detail view is portalled into `<body>` and the component's inline styles read
`--color-*` values computed on `:root`; the demo sets `dir` and `lang` on
`<html>` for the same reason. Changa and IBM Plex Sans Arabic are self-hosted
from `@fontsource`, so the CSP needs no font host. The hang tags and the
detail counter keep left-to-right order inside the Arabic page.

### What it needs

- **`tw-animate-css`**, imported in `globals.css`, for the caption's
  `animate-in fade-in`. It is Tailwind v4's replacement for the
  `tailwindcss-animate` plugin, which v4 cannot load.
- **Theme tokens** `--color-foreground`, `--color-muted-foreground`, `card`,
  `border` and `ring`, which the shadcn block in `globals.css` already defines.
  The rail's metal and the hangers are drawn from them, so the component follows
  the light and `.dark` themes.
- No icon library. The only icon (close) is an inline SVG.

### Photos, and why the demo does not use Unsplash

Every piece can be drawn without a photo: give it `kind` (`tee`, `knit`,
`hoodie`, `shirt`, `jacket`, `coat`), `color` and optionally `trim`, and the
built-in illustration is used.

With photos, they must be **transparent cut-outs on a shared 200 x 310
portrait canvas**, the same canvas and scale for a piece's front, back and side
shots, or the piece changes size as it turns. The component also uses each
photo's alpha as a CSS mask for its shadow and shading. Stock photography such as
Unsplash is full-frame, so every mask would be a solid rectangle.

Sahm has two cups: the kraft paper cup, in small, medium and large, and a white
tumbler. They are drawn for this page from the owner's photos, with the real logo
vectors (the tumbler's print has no tashkeel, as on the real one), and saved as
transparent WebP in `public/cups/` (600 x 930, about 110 KB for all four). Each
carries its own J-hook and the wire ring the cup sits in, so the demo uses
`hanger="none"`; the rims hang at one height and the bottoms show the size. With
no `backImage`, the same face shows on both sides.
There is no side photo: the component shows the front turned away while a cup
rests, which is the right reading for a cylinder.

Photos from another host are fetched as masks in CORS mode, so that host must:

1. send `Access-Control-Allow-Origin`, and
2. be listed under `img-src` in the CSP in `next.config.mjs`.

Served from this app, the cups need neither.

The `<img>` for each photo carries `crossOrigin="anonymous"` for the same
reason: without it the browser can reuse the image's no-cors copy for the mask
fetch of the same URL and block the mask, which left a piece unshaded when the
demo still used remote photos.

### Props

| Prop | Default | Notes |
| --- | --- | --- |
| `items` | — | `RailGarment[]`: `id`, `name`, and optionally `description`, `kind`, `color`, `trim`, `image`, `backImage`, `sideImage`, `tag` (hang-tag text), `details` (chips in the detail view) |
| `eyebrow` / `heading` | — | Header above the rail |
| `caption` | — | Shown while nothing faces the front |
| `action` | — | Node under the caption, e.g. a button |
| `autoplay` | `false` | Turns pieces to the front in turn until the visitor interacts |
| `interval` | `2600` | Milliseconds per piece in autoplay |
| `hanger` | `"wood"` | `"wood"`, `"matte"`, or `"none"` when the photos include their own hanger |
| `labels` | English | `{ front, back, close, show }`, for translating the controls |
| `onOpenChange` | — | Called with the opened index, or `null` on close |

Arrow keys, Home and End move along the rail; Enter opens a piece; in the
detail view, arrows turn it and Escape closes it. Respects
`prefers-reduced-motion`: pieces snap instead of swinging and autoplay is off.

## Static copy on GitHub Pages

Both pages are fully static, so a copy is exported to `gallery/` at the repo
root, which GitHub Pages serves at
https://saadaljammaz35-stack.github.io/-/gallery/ (`/rail/` for the clothing
rail). `gallery/` is build output: regenerate it rather than editing it, by
building this app with a config that sets `output: 'export'`,
`basePath: '/-/gallery'`, `trailingSlash: true` and
`env: { NEXT_PUBLIC_BASE_PATH: '/-/gallery' }` (the cup image URLs are plain
`<img>` paths, which Next does not prefix), and copying `out/` over it.
Pages sends no custom headers, so the CSP in `next.config.mjs` does not apply to
that copy.
