import Link from "next/link";
import { getLocale } from "@/lib/locale";
import { getLimits } from "@/lib/settings";

export const metadata = { title: "FAQ" };

export default async function Faq() {
  const ar = (await getLocale()) === "ar";
  const limits = await getLimits().catch(() => null);
  const n = limits?.monthlyInspectionsPerUser ?? 3;
  const secs = limits?.maxVideoSeconds ?? 60;
  const qa: [string, string][] = ar
    ? [
        ["هل الخدمة مجانية فعلاً؟", `نعم. لكل حساب ${n} فحوصات مجانية شهرياً، لأن كل تحليل يكلّفنا تكلفة حقيقية لدى مزوّد الذكاء الاصطناعي. لا نطلب بطاقة دفع.`],
        ["كم يستغرق التقرير؟", "عادة دقائق قليلة بعد الإرسال. تتحدث صفحة الفحص تلقائياً، ونرسل لك بريداً عند جاهزية التقرير."],
        ["من يرى صوري؟", "أنت فقط من داخل حسابك. تُرسل نسخة منها لمزوّد الذكاء الاصطناعي لتحليلها، وقد يطّلع عليها مشرف الخدمة عند الحاجة للدعم أو مراجعة الجودة، وكل اطلاع إداري مسجّل."],
        ["هل التقرير ضمان لحالة الجهاز؟", "لا. هو تحليل لما يظهر في الصور فقط، وقد يخطئ. يساعدك على معرفة أين تنظر، ولا يغني عن فحص الجهاز بنفسك."],
        ["ما الصور المطلوبة؟", "4 صور على الأقل في إضاءة جيدة دون فلاش مباشر: الواجهة والشاشة مضاءة، الخلف، الأطراف والمنافذ، والكاميرات. أضف صورة قريبة لأي عيب تعرفه."],
        ["هل أستطيع رفع فيديو؟", `نعم، فيديو واحد حتى ${secs} ثانية. نستخرج منه لقطات ونذكر توقيت كل لقطة في التقرير.`],
        ["لماذا رُفضت صورتي؟", "نتحقق من كل ملف. نرفض الملف إذا لم يكن صورة صالحة، أو كان أصغر من 320 بكسل، أو مكرراً، أو بصيغة HEIC. في الآيفون اختر «الأكثر توافقاً» من إعدادات الكاميرا."],
        ["ماذا لو فشل التحليل؟", "لا نصدر تقريراً لم يكتمل تحليله، ولا يُحسب الفحص الفاشل من حصتك. يمكنك إعادة المحاولة من صفحة الفحص."],
        ["بأي لغة يكون التقرير؟", "بالعربية أو الإنجليزية، تختارها عند إنشاء الفحص."],
        ["كيف أحذف بياناتي؟", "من صفحة «حسابي» احذف الحساب، فنحذف نهائياً كل الصور والفيديوهات والتقارير. ويمكنك قبل ذلك تنزيل نسخة من بياناتك."],
      ]
    : [
        ["Is it really free?", `Yes. Each account gets ${n} free inspections per month, because every analysis has a real cost at the AI provider. No card required.`],
        ["How long does a report take?", "Usually a few minutes after you submit. The inspection page updates by itself and we e-mail you when the report is ready."],
        ["Who can see my photos?", "Only you, from your account. A copy is sent to the AI provider for analysis, and the service operator may look at them for support or quality review; every admin access is logged."],
        ["Is the report a guarantee?", "No. It analyses only what the photos show and it can be wrong. It helps you know where to look; it does not replace checking the device yourself."],
        ["Which photos do you need?", "At least 4 well-lit photos without direct flash: front with the screen on, back, edges and ports, and cameras. Add a close-up of any defect you know about."],
        ["Can I upload a video?", `Yes, one video up to ${secs} seconds. We extract frames and cite each frame's timestamp in the report.`],
        ["Why was my photo rejected?", "We check every file. We reject files that aren't valid images, are smaller than 320 px, are duplicates, or are HEIC. On iPhone choose \"Most Compatible\" in Camera settings."],
        ["What if the analysis fails?", "We never issue a report without a completed analysis, and a failed inspection does not count towards your quota. You can retry from the inspection page."],
        ["Which language is the report in?", "Arabic or English; you choose when you create the inspection."],
        ["How do I delete my data?", "Delete your account from the Account page and we permanently remove every photo, video and report. You can download a copy of your data first."],
      ];
  return (
    <div className="wrap page" style={{ maxWidth: 820 }}>
      <h1>{ar ? "الأسئلة الشائعة" : "Frequently asked questions"}</h1>
      <div style={{ marginTop: 20 }}>
        {qa.map(([q, a]) => (
          <details className="faq" key={q}><summary>{q}</summary><p>{a}</p></details>
        ))}
      </div>
      <p style={{ marginTop: 28 }}>{ar ? "سؤالك غير موجود؟" : "Question not here?"} <Link href="/contact">{ar ? "تواصل معنا" : "Contact us"}</Link></p>
    </div>
  );
}
