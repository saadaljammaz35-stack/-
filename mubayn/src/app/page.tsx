import Link from "next/link";
import { DeviceFigure } from "@/components/device-figure";
import { getLocale } from "@/lib/locale";
import { getLimits } from "@/lib/settings";

export default async function Home() {
  const locale = await getLocale();
  const ar = locale === "ar";
  const limits = await getLimits().catch(() => null);
  const perMonth = limits?.monthlyInspectionsPerUser ?? 3;
  return (
    <>
      <section className="hero">
        <div className="wrap hero-grid">
          <div className="reveal">
            <span className="eyebrow">{ar ? "فحص بصري بالذكاء الاصطناعي · مجاني" : "AI visual inspection · free"}</span>
            <h1 style={{ marginTop: 14 }}>
              {ar ? "قبل أن تدفع ثمن جهاز مستعمل، اعرف ما تُظهره صوره فعلاً." : "Before you pay for a used device, see what its photos actually show."}
            </h1>
            <p className="lead">
              {ar
                ? "ارفع صور الجهاز أو فيديو قصيراً. يفحص مُبيِّن كل صورة ويعطيك تقريراً يربط كل ملاحظة بالصورة التي تُثبتها."
                : "Upload photos or a short video of the device. MUBAYN examines every image and gives you a report where each finding points to the photo that proves it."}
            </p>
            <div className="row" style={{ marginTop: 26 }}>
              <Link href="/register" className="btn btn-signal">{ar ? "ابدأ فحصاً مجانياً" : "Start a free inspection"}</Link>
              <Link href="/ai-limits" className="btn btn-ghost">{ar ? "ما الذي يكشفه وما الذي لا يكشفه" : "What it can and cannot see"}</Link>
            </div>
            <p className="small muted" style={{ marginTop: 16 }}>
              {ar ? `${perMonth} فحوصات مجانية لكل حساب شهرياً. بلا بطاقة دفع.` : `${perMonth} free inspections per account each month. No card needed.`}
            </p>
          </div>
          <DeviceFigure locale={locale} />
        </div>
      </section>

      <section className="section section-alt" id="how">
        <div className="wrap">
          <span className="eyebrow">{ar ? "كيف يعمل" : "How it works"}</span>
          <h2 style={{ marginTop: 10 }}>{ar ? "ثلاث خطوات، وتقرير تستطيع التحقق منه" : "Three steps, and a report you can check"}</h2>
          <div className="steps" style={{ marginTop: 26 }}>
            {(ar
              ? [
                  ["اكتب بيانات الجهاز", "النوع والموديل، وألصق ما يقوله البائع في إعلانه كما هو."],
                  ["ارفع الأدلة", "4 صور على الأقل في إضاءة جيدة: الواجهة، الخلف، الأطراف، الكاميرات. ويمكنك إضافة فيديو قصير."],
                  ["استلم التقرير", "خلال دقائق عادة: درجة حالة، ملاحظات مرتبة حسب الخطورة، وكل ملاحظة مربوطة برقم الصورة. مع نسخة PDF."],
                ]
              : [
                  ["Describe the device", "Type and model, and paste what the seller's listing says, word for word."],
                  ["Upload the evidence", "At least 4 well-lit photos: front, back, edges, cameras. Add a short video if you like."],
                  ["Get the report", "Usually within minutes: a condition score, findings ranked by severity, each tied to a photo number. Plus a PDF."],
                ]
            ).map(([h, p], i) => (
              <div className="step" key={h}>
                <div className="step-num">0{i + 1}</div>
                <h3 style={{ marginTop: 6 }}>{h}</h3>
                <p className="muted">{p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap grid-2" style={{ alignItems: "center" }}>
          <div>
            <span className="eyebrow">{ar ? "داخل التقرير" : "Inside the report"}</span>
            <h2 style={{ marginTop: 10 }}>{ar ? "كل ملاحظة لها دليل. وما لا يظهر يُقال إنه لا يظهر." : "Every finding has proof. What isn't shown is called out as not shown."}</h2>
            <p className="muted">
              {ar
                ? "لا يخمّن مُبيِّن. إذا لم تُظهر الصور جزءاً من الجهاز، يذكر التقرير ذلك صراحةً ويقترح عليك ما تفحصه بنفسك قبل الدفع."
                : "MUBAYN does not guess. If the photos don't show part of the device, the report says so plainly and tells you what to check in person before paying."}
            </p>
          </div>
          <ul className="card stack" style={{ listStyle: "none", margin: 0 }}>
            {(ar
              ? [
                  ["E2", "ملاحظات مرتبة حسب الخطورة مع درجة الثقة"],
                  ["E5", "مقارنة ادعاءات البائع: متوافق، متعارض، أو لا يمكن التحقق"],
                  ["E7", "لقطات الفيديو مع توقيتها داخل المقطع"],
                  ["E9", "قائمة فحص عملية قبل الشراء"],
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
          <h2>{ar ? "صادقون في حدود ما يمكن رؤيته" : "Honest about what a photo can show"}</h2>
          <div className="cando" style={{ marginTop: 20 }}>
            <div className="card">
              <h3>{ar ? "يستطيع أن يلاحظ" : "It can spot"}</h3>
              <ul>
                {(ar
                  ? ["الخدوش والكسور والانبعاجات الظاهرة", "تلف الشاشة الظاهر مثل البقع أو الاحتراق", "تآكل المنافذ والأزرار والزوايا", "اختلاف الصور عن الجهاز أو عن كلام البائع"]
                  : ["Visible scratches, cracks and dents", "Visible screen damage such as spots or burn-in", "Wear on ports, buttons and corners", "Photos that don't match the device or the seller's words"]
                ).map((x) => <li key={x}>{x}</li>)}
              </ul>
            </div>
            <div className="card">
              <h3>{ar ? "لا يستطيع أن يؤكد" : "It cannot confirm"}</h3>
              <ul>
                {(ar
                  ? ["صحة البطارية أو أداء القطع الداخلية", "دخول الماء ما لم يظهر مؤشر واضح", "قفل iCloud أو حظر الرقم التسلسلي", "أصالة القطع أو أن الجهاز لم يُفتح"]
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
                ? "تُحفظ الأدلة في تخزين خاص لا يراه غيرك. نزيل بيانات الموقع من النسخة التي نرسلها للتحليل. وتستطيع حذف حسابك وكل ملفاته في أي وقت."
                : "Evidence is kept in private storage that only you can open. We strip location data from the copy sent for analysis. You can delete your account and every file at any time."}
            </p>
            <Link href="/privacy">{ar ? "سياسة الخصوصية" : "Privacy policy"}</Link>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <h3>{ar ? "جرّبه على الجهاز الذي تفكر في شرائه" : "Try it on the device you're thinking of buying"}</h3>
            <p className="muted">{ar ? "اطلب من البائع صوراً واضحة، أو صوّره بنفسك عند المعاينة." : "Ask the seller for clear photos, or take them yourself when you see it."}</p>
            <Link href="/register" className="btn btn-signal">{ar ? "ابدأ فحصاً مجانياً" : "Start a free inspection"}</Link>
          </div>
        </div>
      </section>
    </>
  );
}
