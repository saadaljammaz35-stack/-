import type { Locale } from "@/lib/i18n";

/**
 * Hero photo with evidence tags placed on details that are visible in it.
 * The photo is AI-generated (Higgsfield) and labelled as illustrative; it is
 * not a customer photo and the tags are not a real report.
 */
export function DeviceFigure({ locale }: { locale: Locale }) {
  const ar = locale === "ar";
  // Physical positions: they point at places in the photo, whatever the text direction.
  const pins: { ref: string; text: string; style: React.CSSProperties }[] = [
    { ref: "E1", text: ar ? "خدش خفيف فوق الشاشة" : "Hairline scratch, top of screen", style: { top: "19%", right: "6%" } },
    { ref: "E4", text: ar ? "أثر احتكاك على الإطار" : "Scuff on the frame", style: { top: "56%", right: "-5%" } },
    { ref: "E6", text: ar ? "منفذ الشحن والسماعة" : "Charging port and speaker", style: { top: "85%", left: "3%" } },
  ];
  return (
    <figure className="device-figure" style={{ margin: 0 }}>
      <img
        src="/img/hero-phone-800.webp"
        srcSet="/img/hero-phone-480.webp 480w, /img/hero-phone-800.webp 800w"
        sizes="(max-width: 880px) 230px, 360px"
        width={800}
        height={1000}
        fetchPriority="high"
        decoding="async"
        alt={ar ? "جوال مستعمل على قماش فاتح، فيه خدش خفيف فوق الشاشة وأثر على الإطار" : "A used phone on light linen, with a hairline scratch near the top of the screen and a scuff on the frame"}
        style={{ width: "100%", height: "auto", display: "block", borderRadius: 26, boxShadow: "var(--shadow)" }}
      />
      <div className="scan" aria-hidden="true" />
      {pins.map((p) => (
        <div key={p.ref} className="pin" style={p.style} aria-hidden="true">
          <span className="ref">{p.ref}</span>
          <span>{p.text}</span>
        </div>
      ))}
      <figcaption className="small muted" style={{ textAlign: "center", marginTop: 10 }}>
        {ar ? "صورة توضيحية مولّدة بالذكاء الاصطناعي" : "Illustrative, AI-generated photo"}
      </figcaption>
    </figure>
  );
}
