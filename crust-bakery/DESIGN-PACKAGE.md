# CRUST Bakery — Design Package

The single creative document for the site. Written before generation, consumed by the build.
Every line of copy below ships verbatim. Numbers marked "starting point" are validated by the
flick test during the build.

Tier 1: one continuous six second shot, scroll scrubbed. Hero height 400vh.

---

## 1. The brand premise

**The knot.** CRUST's signature bun is tied, not moulded: a strand of soft dough folded over
itself by hand, one at a time, then baked and drizzled. The whole site teaches that one idea.
A knot takes hands and it takes time, and that is exactly what a box of them says when it
arrives at somebody's gathering. Every section serves it: the film shows the finish, the three
steps show the making, the interactive moment lets the visitor tie one, and the closing line
sends them to The Chefz to have a warm box sent.

The promise the page must land in three seconds, drawn from what Riyadh customers actually
complain about (stale, doughy, bland filling, "tasted like it was baked yesterday"):
**this is warm, it is real, and it will not embarrass you in front of your guests.**

## 2. The palette as CSS tokens

Sampled from the brand's own packaging: the cream of the lid, the soft blue of the stripes,
the cocoa of the drizzle, the caramel of the dough.

```css
:root{
  --canvas:#F4E7D4;         /* parchment cream, sampled from the box lid, never pure white */
  --panel:#FBF3E6;          /* raised cards and surfaces */
  --ink:#2A1710;            /* deep cocoa, sampled from the chocolate */
  --text-primary:#2A1710;
  --text-secondary:#6B4A34; /* warm brown for body and captions */
  --accent:#3E5A86;         /* the stripe blue, deepened so cream text on it passes 6:1 */
  --accent-hover:#2F4568;
  --accent-muted:#A8C0D8;   /* the literal stripe tone: rules, borders, glows, particles */
  --caramel:#A97B41;        /* the dough tone, for the stripe motif and warm emphasis */
}
```

Accent discipline: the deep blue appears on the order button, on focus rings, and on the
interactive moment when it completes. Nowhere else.

## 3. The type trio

Arabic is not Latin at a different size: it carries its diacritics above and below the line, so
every Arabic heading runs at 1.38 line-height and every Arabic paragraph at 1.85, against the
Latin 1.08 and 1.65. On a phone the body sits at 16px, never smaller.


| Role | Latin | Arabic | Weights |
|---|---|---|---|
| Display | Bodoni Moda | Amiri | 400, 600 |
| Body | Karla | Tajawal | 400, 500, 700 |
| Labels | DM Mono | Tajawal 500, letterspaced | 400 |

Bodoni Moda is chosen because the CRUST wordmark is a fine hairline didone; the page and the
logo read as one hand. Amiri carries the same high contrast into Arabic. Google Fonts serves
Arabic glyphs by unicode range, so an English reader never downloads the Arabic faces.

## 4. The band map (hero captions)

The film: a ribbon of warm chocolate falls from the top of the frame onto a hand tied cinnamon
knot below, and comes to rest close on the finished knot. The ribbon and the knot own the left
half of the frame. The caption lane is the right column, which suits both reading directions:
Arabic sits right aligned in it, English left aligned in it.

| Band | Range (starting point) | Footage moment | Copy EN (verbatim) | Copy AR (verbatim) | Entrance |
|---|---|---|---|---|---|
| 1 | 0.00 to 0.20 | the ribbon starts to fall, light and flour dust in the beam | "Tied by hand. This morning." | "تُعقد بأيدينا، هذا الصباح." | drift down, with the one time load ramp |
| 2 | 0.24 to 0.46 | the ribbon falls through the light | "Soft all the way through." | "طرية من الطرف إلى القلب." | blur to sharp |
| 3 | 0.50 to 0.72 | the chocolate lands on the knot | "Then the chocolate." | "ثم تأتي الشوكولاتة." | word punch with overshoot |
| 4 | 0.78 to 1.00 | settled, glossy, steam still moving | headline + subline + CTA (below) | headline + subline + CTA (below) | word by word rise into a staged settle |

Band 4 settle copy:

- Headline EN: "Warm buns, tied by hand in Riyadh." AR: "خبز دافئ، معقود بالأيدي في الرياض."
- Subline EN: "Small batches. Tied, baked, sent." AR: "دفعات صغيرة. تُعقد، وتُخبز، وتُرسل."
- CTA EN: "Order on The Chefz" AR: "اطلب من ذا شفز"

## 5. The static hero copy block (phones and reduced motion)

Composed over the ending frame, no journey behind it.

- Kicker EN: "Riyadh, since 2024" AR: "الرياض، منذ ٢٠٢٤"
- Headline EN: "Tied by hand. This morning." AR: "تُعقد بأيدينا، هذا الصباح."
- Subline EN: "Warm specialty buns, sent across Riyadh." AR: "خبز مميز ودافئ، يصل إليك في الرياض."
- CTA EN: "Order on The Chefz" AR: "اطلب من ذا شفز"

## 6. The below fold outline

Every section funnels to one anchor: the order button, which opens CRUST on The Chefz.
No two neighbouring sections share a layout skeleton.

**A. The knot (three steps).** Kicker EN "The knot" / AR "العقدة".
Headline EN: "Every knot is tied by hand." AR: "كل عقدة تُعقد باليد."
1. EN "The dough rests." / "Slow and cold, until it is soft enough to pull without tearing."
   AR "العجين يرتاح." / "ببطء وفي البرد، حتى يصبح طرياً يمتد دون أن ينقطع."
2. EN "The knot is tied." / "By hand, one at a time. No mould, no machine."
   AR "العقدة تُعقد." / "باليد، واحدة تلو الأخرى. بلا قوالب ولا آلات."
3. EN "Straight from the oven." / "Baked in small batches, packed warm, and on its way."
   AR "من الفرن مباشرة." / "تُخبز بدفعات صغيرة، وتُعبأ دافئة، وتنطلق إليك."
Each step carries its own image. Three steps, three images, equal treatment.

**B. The interactive moment (inside section A).** Press and hold to tie a knot: a drawn strand
of dough crosses over itself as the visitor holds, and the section's promise line lights up when
it closes. Release early and the progress eases back down, it never snaps.
- Prompt EN: "Hold to tie it." AR: "اضغط مع الاستمرار لعقدها."
- On completion EN: "That is the whole secret. Hands, time, and heat."
  AR: "هذا هو السر كله. أيدٍ، ووقت، وحرارة."
- Reduced motion gets the tied state immediately, no hold required.

**C. The menu.** One item, one price, confirmed by the owner: بابكا شوكولاتة, 95 SAR for a box of 24 pieces.
Headline EN: "Chocolate babka. That is all." AR: "بابكا شوكولاتة. وهذا كل شيء."
Lede EN: "One thing only, because one thing made properly beats ten made quickly."
AR: "صنف واحد فقط، لأن صنفاً واحداً يُتقن خير من عشرة تُستعجل."
The owner cut the three explainer cards: the item and the price carry the section alone,
and the film's resting frame follows immediately as a full bleed band.

**D. The box.** Uses the brand's real packaging photograph. The owner cut the three point fact
list here too, so the section is the photograph, the headline, one paragraph and the order button.
Headline EN: "A box that arrives looking like a gift." AR: "علبة تصل وكأنها هدية."
Body EN: "Cream and blue stripes, rows of knots under the lid, opened at the table. It travels
the way it left the oven, and it looks like you thought about it."
AR: "خطوط كريمية وزرقاء، وصفوف من العقد تحت الغطاء، تُفتح على الطاولة. تصل كما خرجت من الفرن،
وتبدو وكأنك اخترتها بعناية."

**E. The questions people actually ask (FAQ).** Written from the real objections in the research.
Confirmed by the owner: delivery covers all of Riyadh; hours are every day 12 noon to 10 at
night, and Friday 9 in the morning to 8 in the evening. The Arabic across the whole site is the
owner's own dialect, and the word for by hand is باليد.
- EN "Will it still be warm?" AR "هل تصل دافئة؟"
- EN "How do I order?" AR "كيف أطلب؟" / Answer: through The Chefz, which handles the delivery.
- EN "Do you deliver to my area?" AR "هل توصلون إلى منطقتي؟"
- EN "Can I order for a gathering?" AR "هل أستطيع الطلب لمناسبة؟"
Every answer carries a fact the owner confirmed. Nothing invented.

**F. The close.** Headline EN: "Send a warm box." AR: "أرسل علبة دافئة."
Line EN: "Ordering happens on The Chefz. Two taps and it is on its way."
AR: "الطلب يتم عبر ذا شفز. نقرتان وتكون في طريقها إليك."
CTA EN: "Order on The Chefz" AR: "اطلب من ذا شفز"

**The form, decided honestly.** There is no form on this site and that is the right call: the
product is already sold on The Chefz, so the call to action links straight to the existing
ordering page rather than collecting a message that nobody would answer. Large order enquiries
go to the brand's Instagram, linked in the footer.

**G. The footer.** Instagram, TikTok, The Chefz. Riyadh, est. 2024. Language switch.
The imagery note was removed at the owner's instruction after he saw it live. The tradeoff was
put to him plainly first: the hero footage is generated, not photographed in his kitchen, and the
note is what protects him if a customer notices. His site, his call.

## 7. The vector layer plan

The signature is the stripe, taken straight off the packaging.

- **Stripe rules** drawn in SVG that draw themselves on scroll (stroke dashoffset), separating
  every major section. Cream and soft blue, the box's own rhythm.
- **The stripe ribbon**: a single continuous striped band that runs down the page edge, visible
  at whisper level, tying the sections into one object.
- **The knot**: a hand drawn SVG path that ties itself for the interactive moment.
- **Flour dust**: a few particles drifting at whisper level over the warm background, paused
  off screen and on hidden tabs.
- **The environment layer**: one fixed warm glow that drifts on a 70 second cycle behind
  everything, plus fine grain, so scrolling feels like moving through one warm room.
- Reduced motion shows every final state and stops every drive.

## 7b. The phone decision, revisited

The build shipped with the static hero on phones. The owner saw it, asked for the film there too,
and the three conditions the standard sets were all met: the encoded film is 3.0MB, the action
lane (the falling ribbon and the babka, both left of centre) survives a portrait crop, and he
verifies it on his own phone. So the gates shrank to two, reduced motion and a sideways phone
with no room, and the portrait hero was redesigned: the captions moved from the side lane to the
bottom, the scrim became a bottom gradient, and the hero grew to 480vh so every beat still holds
for five flicks. Measured after: worst pixel contrast 13.2, 15.1, 14.6 and 5.4 to one.

The honest cost, said out loud to the owner: a phone visitor now downloads 3MB behind the poster.

## 8. The engineering list

The full standard, nothing half remembered: the streamed Blob fetch behind an honest loading
ring with a watchdog, the dt normalized lerp in a rAF loop that rests, gated seeks with the
deadlock escape, delta gated DOM writes, band pacing validated by the flick test, the four
layer legibility system audited against each band's worst frame at 3.5:1 or better, the five
static hero gates matched character for character in CSS and JS and kept live with change
listeners, complete and beautiful without the video, and the quality floor in full.

## 9. The copy gate

Every viewer facing line above ships verbatim. Before anyone sees the build it must pass the
grep gate: zero em dashes, zero stock words (leverage, seamless, empower, unlock, robust,
actionable, data driven, solutions), and the body copy sweep for AI tells. The deliberate brand
devices here (the triplet "Tied, baked, sent", the three step staccato) are craft and stay.
