/**
 * Chart colours, taken from the brand ramps (src/index.css) and checked with
 * the dataviz palette validator against the white card surface:
 *   "#175a94,#059669" → lightness band, chroma floor, CVD separation
 *   (ΔE 20.7 deutan), normal-vision floor (ΔE 21.6) and ≥3:1 contrast all pass.
 * Brand navy #0F4C81 itself is too dark for a data mark (fails the lightness
 * band), so marks use navy-600 and the darker navy-700 only for the hovered bar.
 * Text never uses these colours; it stays in the slate text tokens.
 */
export const CHART = {
  /** Single-series bars (daily conversations) and the web-chat series. */
  series1: "#175a94", // navy-600
  /** WhatsApp series (accent-hover teal). */
  series2: "#059669",
  /** Hovered / focused bar. */
  active: "#0f4c81", // navy-700 (brand primary)
  /** Hover band behind the active bar. */
  hoverBand: "#f1f5f9", // slate-100
  /** Gridlines: one step off the white surface, solid hairline. */
  grid: "#e2e8f0", // slate-200
  /** Baseline. */
  axis: "#cbd5e1", // slate-300
} as const;
