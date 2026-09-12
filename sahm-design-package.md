# سهم: Design Package (Tier 1, single journey)

The single deliverable of Phase 5. Written before any generation. Consumed by the build.
Every line of copy here ships verbatim. Numbers are starting points, validated by the flick test.

**What shipped, and why it differs from the plan.** The Higgsfield account is on the free plan,
which refuses the strong image models outright, and this machine's network cannot open the
generated files at all, so the footage could not be inspected before it was built on. Rather than
spend the last credits on a shot nobody could check, the hero ships as a hand-drawn SVG pour,
scrubbed by scroll on exactly the band system below. Every other decision in this package shipped
as written. Swapping in generated footage later is a contained change: add the video element and
the Blob loader from `scrub-pipeline.md` inside `.stage`, drive `requestSeek(shown * duration)`
from the same loop that now calls `drawPour(shown)`, and the bands, the scrims and the settle
stay exactly as they are.

---

## 1. The brand premise

سهم means arrow. An arrow does one thing: it goes straight to the point.

That is the whole site. سهم is a coffee shop that removes the detour between wanting coffee
and holding it: a menu short enough to read in one breath, plain words instead of barista
jargon, a roast date printed on every bag, and one price you can see before you order.
The research pain was "ما أعرف وش أطلب" and "كل الكافيهات صارت نسخة وحدة". The answer is the
name itself. Every section, the interactive moment, and the closing line serve that one idea.

The café has not opened yet. So the single call to action is joining the opening list, which
runs through WhatsApp: the form composes the message and opens the owner's chat with it ready
to send.

**Revision, at the owner's request:** the short-menu section came out (prices are not settled
before opening) and a contact section took its place, carrying the three real channels. The
whole page was rewritten into Najdi rather than neutral Gulf Arabic.

## 2. The palette as CSS tokens

Sampled from the brand's own materials (espresso brown, kraft paper, bone) and the planned
footage (a dark roastery world with one warm key light). Finalized against the approved
footage after the video gate.

```css
:root{
  --canvas:#14100E;          /* deep roasted brown-black, tinted to the footage grade */
  --panel:#1E1712;           /* cards and raised surfaces */
  --accent:#E2492B;          /* signal vermilion: the arrow's fletching. CTA and rare emphasis */
  --accent-hover:#F4603F;
  --accent-muted:rgba(226,73,43,.22);   /* borders, glows, particles */
  --text-secondary:#C2B2A4;
  --text-primary:#F5EFE7;    /* bone, pulled from the logo's cream ground */
  --kraft:#C9A47A;           /* the cup's paper, the secondary warm tone */
  --espresso:#3E2C23;        /* the logo's brown */
}
```

Deviation said out loud: the skill bans "near-black with a warm amber accent" as a default
reach. This canvas is not near-black (it is a roasted brown at #14100E, tinted to the
footage) and the accent is a saturated signal vermilion, not amber, used only on the CTA,
focus rings, the arrow rail's head, and two emphasis words. No serif anywhere.

## 3. The type trio

| Role | Face | Weights | Why |
|---|---|---|---|
| Display | **Changa** | 700, 800 | Arabic + Latin, slightly condensed, has speed in it. Not a habitual default. |
| Body | **IBM Plex Sans Arabic** | 400, 500 | Quiet, excellent Arabic rendering, pairs with the mono. |
| Mono | **IBM Plex Mono** | 400, 500 | Latin small labels, numbers, prices, the roast-date stamp. |

Never Inter, never Roboto. Page direction is RTL, Arabic primary, English as a quiet second line.

## 4. The band map

Hero height 620vh (scroll range 520vh). Ranges were validated by the flick test after the build:
every beat holds full opacity for seven 120px flicks, and no beat is skippable at 360px.

| Band | Range | What the pour is doing | Copy (verbatim) | Entrance |
|---|---|---|---|---|
| 1 | 0.00 to 0.20 | the stream begins its fall at the top of frame | **قهوة على طول.**<br>Straight to the point. | drift-down (words fall with the pour) |
| 2 | 0.24 to 0.46 | the stream mid-fall, light streaking past it | **ما نطوّل عليك.**<br>تقول وش تبي، ويجيك. | grid snap-align (words slide into order) |
| 3 | 0.50 to 0.70 | the stream lands, crema swirling | **محمّصة توّها، والتاريخ مكتوب.** | word-punch with overshoot (the impact) |
| 4 | 0.76 to 1.00 | the cup at rest, steam drifting | **سهم يفتح قريب.**<br>عطنا رقمك، وأول ما نفتح نبلغك باليوم والمكان.<br>[خلّنا نبلغك] [تواصل معنا] | word-by-word rise into a staged settle |

Band 1 skips the opacity ease-in and gets the one-time load ramp. Band 4 skips the ease-out.

## 5. The static-hero copy block

For phones, portrait tablets, and reduced motion. Composed over the ending frame.

- Headline: **قهوة على طول.**
- Subline: **سهم كافيه يفتح قريب في الرياض. تدخل، تقول وش تبي، وتطلع بكوبك.**
- CTA: **خلّنا نبلغك**
- Under the CTA, small: **رسالة وحدة يوم الافتتاح. بس.**

## 6. The below-fold outline

Every section funnels to one anchor: `#list`.

### 6.1 البداية (the premise, full-bleed statement)
> **كل كافيه يقول إنه مختلف.**
> **إحنا نقولها بثلاث كلمات: قهوة على طول.**
>
> ما نبيك تقف قدام المنيو تفكر. تقول وش تبي، وتستلمه، وتكمل يومك.

### 6.2 تواصل (three channel rows, replacing the menu at the owner's request)
Kicker: **تلقانا هنا** / Heading: **تبي تسأل؟ إحنا قريبين.**
Note: **أي سؤال عن الافتتاح أو الطلبات، كلّمنا على طول ونرد عليك.**

| القناة | القيمة | السطر الجنبي |
|---|---|---|
| **واتساب** | 050 457 9511 | أسرع طريقة توصلنا |
| **تيك توك** | @sahm_com | تشوف الشغل أول بأول |
| **إيميل** | saadaljammaz35@gmail.com | للشراكات والطلبات الكبيرة |

Rows, not cards, so the section shares no skeleton with its neighbours. Each row is one link
(wa.me, tiktok.com, mailto), with a hand-drawn line icon and an arrow that slides toward the
reading direction on hover.

### 6.3 الحبوب (freshness, a drawn roast dial rather than a photo, so no section is left unequal)
> **نحمّص بكميات صغيرة، ونكتب التاريخ.**
>
> على كل كيس تلقى يوم التحميص مكتوب بخط واضح، مو مخبأ تحت الكيس. القهوة الطازجة تعطيك حلاوة طبيعية، والقديمة تعطيك مرارة. الفرق يبدأ من التاريخ.

The dial carries the stamp: `ROASTED` / `٠٩` / `SEP 2026`, its arc drawing itself on entry.

### 6.4 الكوب (the real product photo, their own file, shipped untouched)
> **الكوب اللي بيدك.**
>
> ورق كرافت، وشعار مطبوع، وبدون زخرفة زايدة. السهم فوق الاسم، عشان تعرف من وين جاك الكوب قبل لا تشرب منه.

### 6.5 اسحب السهم (the one interactive moment)
Kicker: **جرّبها**
> **اسحب السهم وشوف متى نفتح.**

Press and hold (or touch and hold) draws the bow. Progress builds while held, eases back on
early release, and completing it fires the arrow, which reveals the opening block in sequence:

- **الافتتاح: قريب**
- **الرياض**
- **سجّل في القائمة وتوصلك الرسالة أول واحد**

Reduced motion gets the revealed state immediately, no hold required.

### 6.6 أسئلة تتكرر (the real objections from the research)
- **قهوتكم حامضة؟**: لا. في قهوة مختصة تطلع حامضة لأن التحميص فاتح زيادة أو التحضير غلط. نضبط التحميص على وسط يعطيك حلاوة وجسم، ولو طلعت غير كذا رجّعها لنا ونسوي لك وحدة ثانية.
- **ليه أغلى من كوب عادي؟**: لأن الحبة أغلى والكمية أقل والتحميص أقرب. السعر مكتوب في المنيو فوق، تشوفه قبل لا تطلب.
- **متى تفتحون ووين؟**: قريب، في الرياض. سجّل في القائمة ونرسل لك اليوم والموقع أول ما يجهزون.
- **عندكم حليب نباتي؟**: إي، شوفان. بدون فرق في السعر.
- **فيه مكان أقعد فيه؟**: فيه طاولة طويلة ومقاعد عند النافذة، ومساحة تشتغل فيها بهدوء.

### 6.7 القائمة (the single call to action + form)
> **افتح معنا من أول يوم.**
>
> اكتب اسمك ومدينتك، ونفتح لك واتساب برسالة جاهزة. ترسلها وخلاص، ونبلغك باليوم والمكان.

Form microcopy:
- Label: **الاسم** / placeholder: **اسمك**
- Label: **المدينة أو الحي** / placeholder: **الرياض، النرجس**
- Button: **أرسل على واتساب**
- Success state: **فتحنا لك واتساب برسالتك جاهزة. أرسلها وإحنا نرد عليك. لو ما فتح معك، كلّمنا على ٠٥٠ ٤٥٧ ٩٥١١.**
- Under the form, small: **تروح لواتساب سهم مباشرة. ما نرسل إعلانات.**

Handling on a static site: the form needs no backend. On submit it composes
`السلام عليكم، أنا [الاسم] من [المدينة]. أبي تبلغوني يوم يفتح سهم.` and opens
`wa.me/966504579511` with that text ready to send, so a visitor's message lands in the owner's
own WhatsApp. The success state says exactly that, including the number to fall back on if the
popup is blocked.

### 6.8 الفوتر
- The real logo (their file), the one line **قهوة على طول.**، and the opening city.
- Social row, a link back to `#list`.
- The brand is real, so no fictional-brand disclosure. One honest line instead:
  **الصور في هذي الصفحة من إنتاجنا بالذكاء الاصطناعي، والكوب والشعار حقيقيون. صور المحل تنزل يوم الافتتاح.**

## 7. The vector layer plan

- **The signature element: the arrow rail.** One hairline runs the full page in the right
  margin (RTL), drawn in SVG. A vermilion arrowhead rides it at the scroll position, and at
  each section the rail fires a short arrow into that section's kicker. Remove it and the
  page changes: the sections lose their spine and the name loses its argument.
- **Self-drawing rules** under each section heading, `stroke-dashoffset` driven by an
  IntersectionObserver.
- **Whisper particles:** slow drifting dust motes in the fixed background layer, in
  `--accent-muted` and `--kraft`, 60s cycle, paused off-screen and on hidden tabs.
- **The fixed background environment:** one layer behind everything, a very slow warm
  radial drift plus grain, so scrolling feels like one place.
- Reduced motion: rails drawn to full, arrowhead parked at its final position, particles
  stopped, hold interaction shown complete.

## 8. The engineering list

The full standard, so the build cannot half-remember it:

- Video fetched as a Blob; streamed with the honest loading ring if it is over about 8 MB.
- Poster painted first, blob fetch starting only after the poster lands or fails, plus the
  4s safety timer and the 20s no-progress watchdog.
- dt-normalized lerp in a rAF loop that rests when converged and when the hero is off-screen.
- Gated seeks with newest-target coalescing and the error-path deadlock escape.
- Delta-gated DOM writes; ~10Hz throttle on any scroll-driven text.
- Band pacing in scroll distance, validated by the flick test at 120, 240 and 360px.
- The four-layer legibility system: global scrim, per-band scrim riding `--k`, the
  three-layer text-shadow token, chip scrims for small labels. Worst-frame audit at 3.5:1.
- The five static-hero gates, identical in CSS and JS, armed and disarmed from change
  listeners.
- Complete without the video: the page is finished and beautiful over the poster alone.
- The quality floor in full: trimmed fonts with preconnect, `ch` sizing on text elements,
  computed contrast, semantic landmarks, skip link, decorative video out of the tab order,
  `:focus-visible` in the accent, 44px touch targets, real title and meta, inline SVG
  favicon of the arrow, `overflow-x: clip` on html and body, og tags patched at deploy.
- RTL: `dir="rtl"` on the document, logical properties everywhere, the rail in the right margin.

## 9. The copy gate line

Every viewer-facing line above ships verbatim. Before anyone sees the page it must pass the
copy gate: zero em dashes, zero stock words (leverage, seamless, empower, unlock, robust,
actionable, data-driven, solutions), and the body-copy sweep for AI tells. The deliberate
brand devices here are craft and stay: the triplet **الحليب / الأسود / البارد**, and the
staccato **ثلاثة. وكلها صح.**
