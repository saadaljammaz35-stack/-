import { LogoMark } from "@/components/logo";
import { getLocale } from "@/lib/locale";

export const metadata = { title: "Brand", robots: { index: false } };

const COLORS = [
  { hex: "#121A24", ar: "حبر", en: "Ink", useAr: "الشعار، النصوص، الأزرار الثانوية", useEn: "Logo, text, secondary buttons", dark: true },
  { hex: "#F3EFE6", ar: "ورق", en: "Paper", useAr: "الخلفية الأساسية", useEn: "Main background", dark: false },
  { hex: "#F2A93B", ar: "كهرمان", en: "Amber", useAr: "نقطة الدليل وخط المسح والزر الرئيسي فقط", useEn: "Evidence dot, scan line and the main action only", dark: false },
  { hex: "#2A3542", ar: "حبر فاتح", en: "Ink 2", useAr: "عناوين فرعية", useEn: "Secondary headings", dark: true },
  { hex: "#5C6675", ar: "رمادي", en: "Muted", useAr: "نصوص مساعدة", useEn: "Supporting text", dark: true },
  { hex: "#FFFDF8", ar: "بطاقة", en: "Card", useAr: "البطاقات والنماذج", useEn: "Cards and forms", dark: false },
];

const FILES = [
  ["mubayn-logo.svg", "الشعار الكامل (SVG)", "Full logo (SVG)"],
  ["mubayn-logo.png", "الشعار الكامل (PNG)", "Full logo (PNG)"],
  ["mubayn-logo-reversed.svg", "للخلفيات الغامقة (SVG)", "For dark backgrounds (SVG)"],
  ["mubayn-logo-reversed.png", "للخلفيات الغامقة (PNG)", "For dark backgrounds (PNG)"],
  ["mubayn-mark.svg", "الرمز (SVG)", "Mark (SVG)"],
  ["mubayn-mark-512.png", "الرمز (PNG)", "Mark (PNG)"],
  ["mubayn-social.svg", "صورة المشاركة (SVG)", "Social card (SVG)"],
] as const;

export default async function Brand() {
  const ar = (await getLocale()) === "ar";
  return (
    <div className="wrap page" style={{ maxWidth: 980 }}>
      <span className="eyebrow">{ar ? "الهوية البصرية" : "Brand identity"}</span>
      <h1 style={{ marginTop: 10 }}>{ar ? "هوية مُبيّن" : "The MUBAYN identity"}</h1>
      <p className="lead" style={{ maxWidth: "62ch" }}>
        {ar
          ? "فكرة الهوية «نقطة البيان»: حرف الباء من «مُبيّن» داخل إطار عدسة الكاميرا، ونقطته الكهرمانية هي الدليل اللي يبيّن حالة الجهاز صدق."
          : "The idea is «the point of proof»: the letter ب from مُبيّن inside a camera viewfinder, with its amber dot as the evidence that shows a device's real condition."}
      </p>

      <h2 style={{ marginTop: 34 }}>{ar ? "الشعار" : "Logo"}</h2>
      <div className="grid-2" style={{ marginTop: 14 }}>
        <div className="card" style={{ display: "grid", placeItems: "center", minHeight: 200 }}>
          <img src="/brand/mubayn-logo.svg" alt={ar ? "شعار مُبيّن" : "MUBAYN logo"} width={300} height={123} style={{ width: "min(100%, 300px)", height: "auto" }} />
        </div>
        <div className="card" style={{ display: "grid", placeItems: "center", minHeight: 200, background: "#121A24", borderColor: "#121A24" }}>
          <img src="/brand/mubayn-logo-reversed.svg" alt={ar ? "شعار مُبيّن على خلفية غامقة" : "MUBAYN logo on dark"} width={300} height={123} style={{ width: "min(100%, 300px)", height: "auto" }} />
        </div>
      </div>
      <div className="row" style={{ marginTop: 18, gap: 18 }}>
        <LogoMark className="brand-mark-lg" />
        <span style={{ display: "inline-flex", border: "1px solid var(--line-2)", borderRadius: 20 }}><LogoMark className="brand-mark-lg" tone="paper" /></span>
        <LogoMark className="brand-mark-sm" />
        <span className="small muted" style={{ maxWidth: "40ch" }}>
          {ar ? "الرمز لحاله للأيقونات وصور الحسابات. يبقى واضح حتى بحجم 16 بكسل." : "The mark alone, for icons and avatars. It stays legible down to 16 px."}
        </span>
      </div>

      <h2 style={{ marginTop: 34 }}>{ar ? "الألوان" : "Colours"}</h2>
      <div className="grid-3" style={{ marginTop: 14 }}>
        {COLORS.map((c) => (
          <div key={c.hex} className="card-flat" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ background: c.hex, height: 84, borderBottom: "1px solid var(--line)" }} />
            <div style={{ padding: "10px 14px" }}>
              <strong>{ar ? c.ar : c.en}</strong> <span className="mono small" dir="ltr">{c.hex}</span>
              <div className="small muted">{ar ? c.useAr : c.useEn}</div>
            </div>
          </div>
        ))}
      </div>

      <h2 style={{ marginTop: 34 }}>{ar ? "الخطوط" : "Typography"}</h2>
      <div className="grid-3" style={{ marginTop: 14 }}>
        <div className="card">
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "2rem", lineHeight: 1.3 }}>مُبيّن</div>
          <strong>Readex Pro</strong>
          <div className="small muted">{ar ? "الشعار والعناوين" : "Logo and headings"}</div>
        </div>
        <div className="card">
          <div style={{ fontSize: "1.15rem", lineHeight: 1.7 }}>{ar ? "اعرف وش حالة الجهاز قبل لا تدفع." : "Know the condition before you pay."}</div>
          <strong>IBM Plex Sans Arabic</strong>
          <div className="small muted">{ar ? "النصوص والنماذج" : "Body text and forms"}</div>
        </div>
        <div className="card">
          <div className="row" style={{ gap: 8 }}><span className="ref">E1</span><span className="ref">E4</span><span className="ref">E7</span></div>
          <strong style={{ display: "block", marginTop: 10 }}>IBM Plex Mono</strong>
          <div className="small muted">{ar ? "أرقام الأدلة والرموز" : "Evidence labels and codes"}</div>
        </div>
      </div>

      <h2 style={{ marginTop: 34 }}>{ar ? "قواعد الاستخدام" : "Usage"}</h2>
      <ul>
        {(ar
          ? [
              "خلّ حول الشعار مسافة فاضية ما تقل عن ربع عرض الرمز.",
              "لا تمطّ الشعار ولا تميّله ولا تغيّر ألوانه أو ترتيبه.",
              "الكهرماني للدليل والإجراء الرئيسي بس، لا تستخدمه للزينة.",
              "على الخلفيات الغامقة استخدم النسخة المعكوسة.",
              "الصور واقعية من أجهزة مستعملة فعلاً، والمولّدة بالذكاء الاصطناعي ننبّه عليها.",
            ]
          : [
              "Keep clear space around the logo of at least a quarter of the mark's width.",
              "Do not stretch, tilt, recolour or rearrange the logo.",
              "Amber is for evidence and the main action only, never decoration.",
              "On dark backgrounds use the reversed version.",
              "Photos are realistic, of genuinely used devices; AI-generated ones are labelled.",
            ]
        ).map((x) => <li key={x}>{x}</li>)}
      </ul>

      <h2 style={{ marginTop: 34 }}>{ar ? "نبرة الكلام" : "Voice"}</h2>
      <p style={{ maxWidth: "65ch" }}>
        {ar
          ? "نتكلم نجدي واضح وقريب من الناس. صريحين: ما نوعد بشي ما تبيّنه الصور، ونقول «ما يبان» إذا ما بان. جمل قصيرة، وبدون مبالغة."
          : "Plain, friendly Najdi Arabic. Honest: we never promise what the photos cannot show, and we say «not visible» when it isn't. Short sentences, no hype."}
      </p>

      <h2 style={{ marginTop: 34 }}>{ar ? "الملفات" : "Files"}</h2>
      <div className="row" style={{ marginTop: 10 }}>
        {FILES.map(([f, a, e]) => (
          <a key={f} className="btn btn-sm btn-ghost" href={`/brand/${f}`} download>{ar ? a : e}</a>
        ))}
      </div>
    </div>
  );
}
