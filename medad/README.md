# مِداد | MEDAD — Website

The website of **MEDAD**, a Saudi digital studio: *Digital Experiences. Designed to Matter.*
Arabic-first (RTL) with a full English (LTR) version.

Built with **Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · Motion · three.js · Lenis**.

## Run it

```bash
cd medad
npm install
npm run dev        # http://localhost:3000  → redirects to /ar
npm run build && npm start
npm run lint && npm run typecheck
```

Node.js 20.9 or newer.

## Where things live

| What | Where |
| --- | --- |
| All copy, Arabic & English | `src/content/ar.ts`, `src/content/en.ts` (shared types in `types.ts`) |
| Contact details & social links | `src/config/site.ts` — every field is optional; empty ones are not rendered |
| Portfolio projects (text) | `work.projects` in the two content files |
| Portfolio screenshots & logos | `public/work/*.webp`, `public/work/brand/*.webp` |
| Design tokens (colours, type scale, glass) | `src/app/globals.css` (`@theme` + `@utility`) |
| Hero 3D ink sculpture | `src/components/hero/sculpture/` (plain three.js + custom shaders, loaded lazily) |
| Contact API | `src/app/api/contact/route.ts` |

### Adding or changing a portfolio project

1. Add its text to `work.projects` in **both** `ar.ts` and `en.ts` (and its slug to `ProjectSlug` in `types.ts`).
2. Add screenshots to `public/work/`: `<slug>-desktop.webp` (1600×1000), `<slug>-mobile.webp` (540 wide) and
   `<slug>-page.webp` (a 1200-wide full-page capture shown in the project dialog).
3. Give it a backdrop in `src/components/work/worlds.ts`.

## Contact form

The form validates in the browser and again on the server (`src/lib/contact.ts`). It only shows
"sent" after a delivery channel has accepted the message. Configure **one** of these
(copy `.env.example` to `.env.local`, or set them in your host's dashboard):

- `CONTACT_WEBHOOK_URL` — any HTTPS endpoint that accepts a JSON POST (Formspree, Make, Zapier, n8n, your backend…)
- `RESEND_API_KEY` + `CONTACT_TO_EMAIL` (+ optional `CONTACT_FROM_EMAIL`) — email through [Resend](https://resend.com).
  Without a verified domain, Resend's test sender only delivers to the Resend account's own email.

With neither set (or if delivery fails), the form tells the visitor their message was **not** sent and offers
a button that opens their own mail app with the request already written, addressed to the email in `site.ts`. It also has a honeypot field
and a small per-instance rate limit.

Set `NEXT_PUBLIC_SITE_URL` to the production URL so canonical links, Open Graph and the sitemap are absolute
(on Vercel the production domain is detected automatically).

## Deploying on Vercel

Import the repository and set **Root Directory** to `medad`. Everything else is detected.

## Notes

- `/` redirects to `/ar`; `/en` is the English site. Each service has its own page (`/ar/services/<slug>`).
- Respects `prefers-reduced-motion`: no intro, no smooth scrolling, static sculpture.
- The custom cursor appears only on desktop pointers and never hides the system cursor.
- Fonts (IBM Plex Sans Arabic, Manrope) are self-hosted under the SIL Open Font License — see `src/app/fonts/`.
