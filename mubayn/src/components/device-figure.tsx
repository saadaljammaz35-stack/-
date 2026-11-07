import type { Locale } from "@/lib/i18n";

/** Hero illustration: a device under the scan line, with evidence tags. Illustrative, not a real report. */
export function DeviceFigure({ locale }: { locale: Locale }) {
  const ar = locale === "ar";
  const pins = [
    { top: "15%", side: "62%", ref: "E1", text: ar ? "خدش دقيق أعلى الشاشة" : "Hairline scratch, top of screen" },
    { top: "47%", side: "-8%", ref: "E4", text: ar ? "انبعاج بسيط في الإطار" : "Small dent on the frame" },
    { top: "80%", side: "56%", ref: "E6", text: ar ? "غبار داخل منفذ الشحن" : "Debris inside charging port" },
  ];
  return (
    <figure className="device-figure" style={{ margin: 0 }} aria-label={ar ? "رسم توضيحي لجهاز مع وسوم أدلة" : "Illustration of a device with evidence tags"}>
      <svg viewBox="0 0 300 560" role="img" aria-hidden="true">
        <defs>
          <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#1d2733" />
            <stop offset="0.55" stopColor="#121a24" />
            <stop offset="1" stopColor="#26313e" />
          </linearGradient>
          <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.5" stopColor="#fff" stopOpacity="0.09" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect x="18" y="8" width="264" height="544" rx="44" fill="#cfc6b3" />
        <rect x="26" y="16" width="248" height="528" rx="38" fill="url(#glass)" />
        <rect x="26" y="16" width="248" height="528" rx="38" fill="url(#sheen)" />
        <rect x="112" y="30" width="76" height="22" rx="11" fill="#0b1118" />
        <path d="M186 92 l52 -18" stroke="#f3efe6" strokeOpacity="0.55" strokeWidth="1.2" />
        <path d="M270 250 q-6 14 0 28" stroke="#f2a93b" strokeWidth="2" fill="none" />
        <rect x="128" y="528" width="44" height="8" rx="4" fill="#0b1118" />
        <circle cx="140" cy="532" r="1.6" fill="#8a7f6a" /><circle cx="150" cy="533" r="1.2" fill="#8a7f6a" />
        <g fill="none" stroke="#f3efe6" strokeOpacity="0.12">
          {Array.from({ length: 9 }, (_, i) => <line key={i} x1="26" x2="274" y1={70 + i * 54} y2={70 + i * 54} />)}
        </g>
      </svg>
      <div className="scan" aria-hidden="true" />
      {pins.map((p) => (
        <div key={p.ref} className="pin" style={{ top: p.top, insetInlineStart: p.side }}>
          <span className="ref">{p.ref}</span>
          <span>{p.text}</span>
        </div>
      ))}
      <figcaption className="small muted" style={{ textAlign: "center", marginTop: 10 }}>{ar ? "رسم توضيحي" : "Illustration"}</figcaption>
    </figure>
  );
}
