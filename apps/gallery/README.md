# @nabd/gallery

A standalone Next.js app hosting `MorphGallery`, a WebGL photo gallery whose
slides dissolve into each other through fbm noise.

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

Then open http://localhost:3003.

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

## Props

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
