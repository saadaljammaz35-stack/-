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
    { ref: "E1", text: ar ? "شرخ في زاوية الشاشة" : "Crack at the screen corner", style: { top: "41%", right: "2%" } },
    { ref: "E3", text: ar ? "خدوش على الشاشة" : "Scratches across the screen", style: { top: "60%", left: "4%" } },
    { ref: "E4", text: ar ? "طعجة وتقشير في الإطار" : "Dent and chipped paint on the frame", style: { top: "77%", right: "5%" } },
  ];
  return (
    <figure className="device-figure" style={{ margin: 0 }}>
      <img
        src="/img/hero-majlis-800.webp"
        srcSet="/img/hero-majlis-480.webp 480w, /img/hero-majlis-800.webp 800w"
        sizes="(max-width: 880px) 230px, 360px"
        width={800}
        height={1000}
        fetchPriority="high"
        decoding="async"
        alt={ar ? "جوال مستعمل على طاولة في مجلس، شاشته فيها شرخ وخدوش وإطاره مطعوج، وخلفه دلة وتمر" : "A used phone on a majlis table with a cracked, scratched screen and a dented frame; a coffee pot and dates behind it"}
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
