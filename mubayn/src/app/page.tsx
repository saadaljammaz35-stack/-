import Link from "next/link";
import { DeviceFigure } from "@/components/device-figure";
import { getLocale } from "@/lib/locale";
import { getLimits } from "@/lib/settings";

// Illustrative photos, AI-generated with Higgsfield and labelled as such on the page.
function StepImage({ name, alt }: { name: string; alt: string }) {
  return (
    <img
      className="step-img"
      src={`/img/${name}-1000.webp`}
      srcSet={`/img/${name}-600.webp 600w, /img/${name}-1000.webp 1000w`}
      sizes="(max-width: 760px) 92vw, 380px"
      width={1000}
      height={753}
      loading="lazy"
      decoding="async"
      alt={alt}
    />
  );
}

export default async function Home() {
  const locale = await getLocale();
  const ar = locale === "ar";
  const limits = await getLimits().catch(() => null);
  const perMonth = limits?.monthlyInspectionsPerUser ?? 3;
  const steps: { img: string; alt: string; h: string; p: string }[] = ar
    ? [
        { img: "meetup", alt: "جوال مستعمل مع علبته وسلكه على طاولة كوفي وقت المعاينة مع البائع", h: "اكتب معلومات الجهاز", p: "النوع والموديل، والصق كلام البائع في إعلانه مثل ما هو." },
        { img: "photographing-car", alt: "يد تصوّر جوال مستعمل حاطّه على كبوت سيارة في الرياض", h: "ارفع الأدلة", p: "4 صور على الأقل في مكان نوره زين: الشاشة، الظهر، الأطراف، الكاميرات. وتقدر تضيف فيديو قصير." },
        { img: "port-closeup", alt: "صورة قريبة لمنفذ شحن فيه غبار وزاوية مقشّرة", h: "استلم التقرير", p: "عادةً خلال دقايق: درجة للحالة، وملاحظات مرتبة حسب خطورتها، وكل ملاحظة مربوطة برقم الصورة. ومعه نسخة PDF." },
      ]
    : [
        { img: "meetup", alt: "A used phone with its box and cable on a café table while meeting the seller", h: "Describe the device", p: "Type and model, and paste what the seller's listing says, word for word." },
        { img: "photographing-car", alt: "A hand photographing a used phone placed on a car bonnet in Riyadh", h: "Upload the evidence", p: "At least 4 well-lit photos: front, back, edges, cameras. Add a short video if you like." },
        { img: "port-closeup", alt: "Close-up of a charging port with lint and a chipped corner", h: "Get the report", p: "Usually within minutes: a condition score, findings ranked by severity, each tied to a photo number. Plus a PDF." },
      ];
  return (
    <>
      <section className="hero">
        <div className="wrap hero-grid">
          <div className="reveal">
            <span className="eyebrow">{ar ? "فحص بالصور بالذكاء الاصطناعي · مجاني" : "AI visual inspection · free"}</span>
            <h1 style={{ marginTop: 14 }}>
              {ar ? "قبل لا تدفع في جهاز مستعمل، اعرف وش تقول صوره صدق." : "Before you pay for a used device, see what its photos actually show."}
            </h1>
            <p className="lead">
              {ar
                ? "ارفع صور الجهاز أو فيديو قصير. مُبيّن يفحص كل صورة ويطلّع لك تقرير، كل ملاحظة فيه مربوطة بالصورة اللي تثبتها."
                : "Upload photos or a short video of the device. MUBAYN examines every image and gives you a report where each finding points to the photo that proves it."}
            </p>
            <div className="row" style={{ marginTop: 26 }}>
              <Link href="/register" className="btn btn-signal">{ar ? "ابدأ فحصك المجاني" : "Start a free inspection"}</Link>
              <Link href="/ai-limits" className="btn btn-ghost">{ar ? "وش يقدر يشوف ووش ما يقدر" : "What it can and cannot see"}</Link>
            </div>
            <p className="small muted" style={{ marginTop: 16 }}>
              {ar ? `${perMonth} فحوصات مجانية لكل حساب بالشهر. وما نطلب بطاقة.` : `${perMonth} free inspections per account each month. No card needed.`}
            </p>
          </div>
          <DeviceFigure locale={locale} />
        </div>
      </section>

      <section className="section section-alt" id="how">
        <div className="wrap">
          <span className="eyebrow">{ar ? "وشلون يشتغل" : "How it works"}</span>
          <h2 style={{ marginTop: 10 }}>{ar ? "ثلاث خطوات، وتقرير تقدر تتأكد منه بنفسك" : "Three steps, and a report you can check"}</h2>
          <div className="steps" style={{ marginTop: 26 }}>
            {steps.map((s, i) => (
              <div className="step" key={s.h}>
                <StepImage name={s.img} alt={s.alt} />
                <div className="step-num">0{i + 1}</div>
                <h3 style={{ marginTop: 6 }}>{s.h}</h3>
                <p className="muted">{s.p}</p>
              </div>
            ))}
          </div>
          <p className="small muted" style={{ marginTop: 14 }}>{ar ? "الصور توضيحية ومولّدة بالذكاء الاصطناعي." : "Photos are illustrative and AI-generated."}</p>
        </div>
      </section>

      <section className="section">
        <div className="wrap grid-2" style={{ alignItems: "center" }}>
          <div>
            <span className="eyebrow">{ar ? "وش داخل التقرير" : "Inside the report"}</span>
            <h2 style={{ marginTop: 10 }}>{ar ? "كل ملاحظة لها دليل. واللي ما يبان نقول إنه ما يبان." : "Every finding has proof. What isn't shown is called out as not shown."}</h2>
            <p className="muted">
              {ar
                ? "مُبيّن ما يخمّن. إذا الصور ما بيّنت جزء من الجهاز، التقرير يقولها لك صريحة ويعلمك وش تفحص بنفسك قبل لا تدفع."
                : "MUBAYN does not guess. If the photos don't show part of the device, the report says so plainly and tells you what to check in person before paying."}
            </p>
          </div>
          <ul className="card stack" style={{ listStyle: "none", margin: 0 }}>
            {(ar
              ? [
                  ["E2", "ملاحظات مرتبة حسب خطورتها، ومعها درجة الثقة"],
                  ["E5", "مقارنة كلام البائع: يطابق، يخالف، أو ما نقدر نتأكد منه"],
                  ["E7", "لقطات الفيديو ووقت كل لقطة داخل المقطع"],
                  ["E9", "قائمة أشياء تفحصها بنفسك قبل لا تشتري"],
                ]
              : [
                  ["E2", "Findings ranked by severity, with a confidence level"],
                  ["E5", "Seller claims check: consistent, contradicted, or not verifiable"],
                  ["E7", "Video frames cited with their timestamp"],
                  ["E9", "A practical in-person checklist before you buy"],
                ]
            ).map(([r, x]) => (
              <li key={r} className="row" style={{ alignItems: "flex-start", flexWrap: "nowrap" }}><span className="ref">{r}</span><span>{x}</span></li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section section-alt">
        <div className="wrap">
          <h2>{ar ? "صريحين في حدود اللي تبيّنه الصور" : "Honest about what a photo can show"}</h2>
          <div className="cando" style={{ marginTop: 20 }}>
            <div className="card">
              <h3>{ar ? "يقدر يلاحظ" : "It can spot"}</h3>
              <ul>
                {(ar
                  ? ["الخدوش والكسور والطعجات اللي تبان", "خراب الشاشة اللي يبان مثل البقع أو الحرق", "تآكل المنافذ والأزرار والزوايا", "إذا الصور مهيب للجهاز نفسه أو تخالف كلام البائع"]
                  : ["Visible scratches, cracks and dents", "Visible screen damage such as spots or burn-in", "Wear on ports, buttons and corners", "Photos that don't match the device or the seller's words"]
                ).map((x) => <li key={x}>{x}</li>)}
              </ul>
            </div>
            <div className="card">
              <h3>{ar ? "ما يقدر يأكد" : "It cannot confirm"}</h3>
              <ul>
                {(ar
                  ? ["صحة البطارية أو أداء القطع اللي من داخل", "إذا دخله موية، إلا لو بان مؤشر واضح", "قفل iCloud أو إذا الرقم التسلسلي محظور", "إن القطع أصلية أو إن الجهاز ما قد انفتح"]
                  : ["Battery health or internal components", "Water damage, unless an indicator is visible", "iCloud lock or a blacklisted IMEI", "Original parts, or that it was never opened"]
                ).map((x) => <li key={x}>{x}</li>)}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap grid-2">
          <div>
            <h2>{ar ? "صورك تبقى لك" : "Your photos stay yours"}</h2>
            <p className="muted">
              {ar
                ? "الأدلة تنحفظ في تخزين خاص ما يشوفه غيرك. نشيل بيانات الموقع من النسخة اللي نرسلها للتحليل. وتقدر تحذف حسابك وكل ملفاته متى ما بغيت."
                : "Evidence is kept in private storage that only you can open. We strip location data from the copy sent for analysis. You can delete your account and every file at any time."}
            </p>
            <Link href="/privacy">{ar ? "سياسة الخصوصية" : "Privacy policy"}</Link>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <h3>{ar ? "جرّبه على الجهاز اللي ناوي تشتريه" : "Try it on the device you're thinking of buying"}</h3>
            <p className="muted">{ar ? "اطلب من البائع صور واضحة، أو صوّره بنفسك يوم تعاينه." : "Ask the seller for clear photos, or take them yourself when you see it."}</p>
            <Link href="/register" className="btn btn-signal">{ar ? "ابدأ فحصك المجاني" : "Start a free inspection"}</Link>
          </div>
        </div>
      </section>
    </>
  );
}
