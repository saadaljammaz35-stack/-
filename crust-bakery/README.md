# CRUST Bakery — website

A static, dependency-free site for CRUST Bakery (كرست بيكري), Al Thumamah, Riyadh.
Arabic is the primary language (RTL); an English version is available through the
toggle in the header and is kept in `data-en` attributes alongside the Arabic copy.

## Files

| File | What it is |
| --- | --- |
| `index.html` | The whole page. The logo is an inline SVG symbol, reused in the header, hero and footer. |
| `styles.css` | Brand tokens (cream, pinstripe blue, foil brown) and layout. Uses logical properties so RTL and LTR both work. |
| `script.js` | Language toggle (remembered in `localStorage`) and scroll reveals. No libraries. |
| `assets/` | Brand photography, the favicon, and `logo-original.jpg` (the source logo artwork). |

## Running it

No build step. Open `index.html`, or serve the folder:

```sh
cd crust-bakery
python3 -m http.server 8080   # then visit http://localhost:8080
```

## Deploying

Any static host works — GitHub Pages, Netlify, Cloudflare Pages, or an S3 bucket.
For GitHub Pages, publish this folder from the repository settings; no other
configuration is needed.

## Content that still needs the owner's input

The page deliberately states only what is confirmed. Add these when you have them:

- **Address and map link** — the page says "الثمامة، الرياض" only. A precise
  address plus a Google Maps link belongs in the `#order` section.
- **Opening hours** — not on the page yet.
- **Phone / WhatsApp number** — ordering currently points only to The Chefz.
- **Prices and exact box sizes** — intentionally left to The Chefz listing so the
  site never shows a stale price.

## Links used

- Orders: https://thechefzco.app.link/9l1cM2fQl6b
- Instagram: https://www.instagram.com/crust_bakerry
- TikTok: https://www.tiktok.com/@crust_bakery

The Instagram and TikTok links were trimmed of their share/tracking parameters
(`stkn`, `_r`, `_t`) — those are tied to a personal session and should not be
published.
