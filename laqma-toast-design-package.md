# لقمة توست — Design Package

Tier 1, one continuous 6 second shot. Written before any generation. Every line of
copy here ships verbatim.

---

## 1. The brand premise

One word carries the whole site: **مقفولة** (sealed).

The round crimped rim is the product's signature detail, and it is also the answer to
every objection a buyer raised in research. Sealed means the jam never sits against
open bread, so nothing goes soggy. Sealed means there is no crust to pick off and
throw away. Sealed means the cold does the preserving, so nothing has to be added.
Everything a breakfast needs is already shut inside one 60 gram bite, and there is
nothing left for anyone to do.

Every section, the interactive moment and the closing line serve that one idea.

## 2. The palette as CSS tokens

Sampled from the film's world: cool blue stone, warm golden peanut butter, deep berry
jam. The canvas is the brand's own blue taken down to night, never pure black. Final
values confirmed against the approved footage after the video gate.

```css
:root{
  --canvas:#0C1620;        /* deep blue slate, tinted to the footage's cool stone */
  --panel:#14212E;         /* cards and raised surfaces */
  --accent:#CB3A5F;        /* berry jam: the CTA and rare emphasis */
  --accent-hover:#E04C72;
  --accent-muted:#6A2438;  /* borders, glows, particles at whisper level */
  --text-secondary:#A7BCCD;
  --text-primary:#F4F1EA;  /* warm off white, the toast crumb */
  --sky:#7FB2D0;           /* the brand's own blue from the pack */
  --gold:#E0A559;          /* peanut butter, imagery only, never UI */
}
```

## 3. The type trio

| Role | Arabic | Latin | Weights |
|---|---|---|---|
| Display | Reem Kufi | Bricolage Grotesque | 500, 700 |
| Body | IBM Plex Sans Arabic | IBM Plex Sans Arabic | 300, 400, 600 |
| Mono (small labels) | IBM Plex Mono | IBM Plex Mono | 400, 500 |

Reem Kufi is geometric and confident, which suits a premium food brand and is nothing
like a default sans. Never Inter, never Roboto.

## 4. The band map

Hero height 400vh. The ribbon falls down the left of centre lane, so the caption
column sits on the right in both languages (a physical `left`/`right` placement, not a
logical one, so switching to English never moves text on top of the action).

| Band | Range (starting point) | Footage moment | Copy (verbatim) | Entrance |
|---|---|---|---|---|
| 1 | 0.00 to 0.20 | the fall begins, ribbon entering the top of frame | **AR** فطور كامل، في لقمة وحدة.<br>**EN** A whole breakfast. One bite. | Drift down (echoes the fall) |
| 2 | 0.24 to 0.46 | the peanut butter ribbon twists past the lens | **AR** زبدة فول سوداني ومربى توت. وبس.<br>**EN** Peanut butter and berry jam. Nothing else. | Word punch with overshoot (echoes the ribbon's snap past camera) |
| 3 | 0.50 to 0.70 | jam droplets drift, the stone surface resolves below | **AR** مقفولة من كل جهة.<br>*sub* ما يطري خبزها، وما فيها قشرة تنرمى.<br>**EN** Sealed on every side.<br>*sub* The bread never goes soggy. There is no crust to pick off. | Halves parting, then closing (the seal motif, inverted) |
| 4 | 0.76 to 1.00 | arrival, the sealed toast at rest on cool stone | **AR** من الفريزر إلى الشنطة.<br>*sub* ما بينهم ولا خطوة.<br>*cta* وين ألقاها<br>**EN** Freezer to bag.<br>*sub* Nothing in between.<br>*cta* Where to find it | Word by word rise into a staged settle |

Band 1 opens already assembled through the one time load ramp. Bands 2 to 4 are purely
scroll driven and reverse on scroll up.

## 5. The static hero copy block

For phones, portrait tablets and reduced motion. Composed over the ending frame.

- **AR** headline: من الفريزر إلى الشنطة.
- **AR** subline: فطور كامل في لقمة وحدة. ٦٠ جرام، جاهزة للأكل.
- **EN** headline: Freezer to bag.
- **EN** subline: A whole breakfast in one bite. 60 grams, ready to eat.
- CTA: وين ألقاها / Where to find it

## 6. The below fold outline

Every section funnels to the one anchor, `#where`.

**S1 — The idea.** Kicker الفكرة / The idea. Headline: **كل شي جوّه، ومقفول.** /
**Everything is already inside.** Body: خبز توست طري، زبدة فول سوداني، ومربى التوت،
مقفولين مع بعض من كل جهة قبل التجميد. ما فيه شي تفتحه، ولا شي تدهنه، ولا شي ترميه. /
Soft toast bread, peanut butter and berry jam, pressed shut on every side before it is
frozen. Nothing to open, nothing to spread, nothing to throw away. The ending frame of
the film is reused here as the section's image.

**S2 — What is inside.** Three cards, each with its own generated still, equal
treatment.
1. خبز توست طري / Soft toast bread — بدون قشرة، ومقصوص دائري عشان يتاكل من أي طرف. /
   No crust, cut round so it eats from any side.
2. زبدة فول سوداني / Peanut butter — ثقيلة ودسمة، وهي الجدار اللي يمنع المربى يوصل
   للخبز. / Thick and rich. It is also the wall that keeps the jam off the bread.
3. مربى التوت / Berry jam — حلو بالقدر اللي يخلّي اللقمة تخلص كاملة. / Sweet enough
   that the last bite goes too.

**S3 — The one interactive moment.** اقفلها بنفسك / Seal it yourself. Press and hold,
and the two halves of the drawn SVG toast press together while the crimped rim closes
around the filling. Release early and it eases back open, never snapping. Completing
it lights three lines in sequence:
- مقفولة، فما يدخلها هواء. / Sealed, so no air gets in.
- الزبدة تمسك المربى بعيد عن الخبز. / The peanut butter holds the jam away from the bread.
- البرودة هي الحافظ الوحيد. / The cold is the only preservative.
Reduced motion gets the finished state with no hold required.

**S4 — The numbers.** Three counters, mono labels.
٦٠ / 60 grams — وزن لقمة طفل، مو وجبة ترجع نص مأكولة / A child's portion, not a meal
that comes home half eaten.
٣ / 3 ingredients — خبز، زبدة فول سوداني، مربى توت / Bread, peanut butter, berry jam.
٠ / 0 — مواد حافظة مضافة / added preservatives. **Pending the owner's confirmation
before it ships.**

**S5 — Where to find it (`#where`, the one call to action).** Headline: وين تلقاها. /
Where to find it. Body: حالياً في **أسواق العريني** و**ثمار العقيلات**، في قسم
المجمدات. / Right now in **أسواق العريني** and **ثمار العقيلات**, in the frozen
section. Button: اسأل عن أقرب فرع / Ask about the nearest shop, opening WhatsApp on
+966 53 906 7680 with a message already written.

**S6 — FAQ.** The real objections found in research, in the buyers' own words.
1. الأكل المجمد فيه مواد حافظة؟ / Does frozen food mean preservatives?
2. كم تحتاج وقت لين تصير جاهزة للأكل؟ / How long until it is ready to eat?
3. الخبز ما يطري؟ / Does the bread go soggy?
4. تكفي طفل؟ / Is it enough for a child?
5. فيها فول سوداني. وش عن الحساسية؟ / It contains peanuts. What about allergies?
6. متى توصل مدينتي؟ / When will it reach my city?

**S7 — Footer.** Brand line, weight and the pack's barcode number, WhatsApp, a TikTok
slot held open, and the honest line: صور وفيديو هذا الموقع منتجة بالذكاء الاصطناعي. /
The photography and film on this site are AI generated.

**The form.** There is none, on purpose. The product is sold in shops, so the one call
to action goes straight to a real WhatsApp conversation rather than a form with nowhere
to send itself. Nothing on the page pretends to collect anything.

## 7. The vector layer plan

- **The signature element: the crimped seal ring.** An SVG circle whose rim is a drawn
  scalloped crimp, exactly the product's own sealed edge. It is the favicon, the nav
  mark, the divider between sections, the shape the counters sit inside, and the core
  of the interactive moment. Remove it and the page loses its identity, which is the
  test it has to pass.
- **A self drawing crimp line** runs down the left of the "what is inside" section,
  drawing itself as the section enters.
- **Whisper level particles:** fine warm gold dust drifting over the deep blue, plus
  one fixed background environment layer (a slow 70 second radial drift in the
  footage's grade) behind the whole page, so scrolling feels like one place.
- All of it honours reduced motion: final states shown, drives stopped.

## 8. The engineering list

The streamed Blob fetch with the honest loading ring and the 20 second watchdog, the
dt normalised lerp in a rAF loop that rests, gated non overlapping seeks with the error
escape, delta gated DOM writes, band pacing validated by the flick test at 120, 240 and
360px, the four layer legibility system audited at 3.5:1 against each band's worst
frame, the five static hero gates matched character for character in CSS and JS and
kept live with change listeners, reduced motion honoured live in both directions,
complete and beautiful without the video, and the full quality floor.

## 9. The copy gate

Every viewer facing line above ships verbatim. The built page must pass the grep gate
before anyone sees it: zero em dashes, zero stock words, plus the body copy sweep for
AI tells. The designed devices here are deliberate and stay: the triplet "ما فيه شي
تفتحه، ولا شي تدهنه، ولا شي ترميه" and the staccato settle "من الفريزر إلى الشنطة. ما
بينهم ولا خطوة."
