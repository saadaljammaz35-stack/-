import Link from "next/link";
import { emailEnabled } from "@/lib/config";
import { getLocale } from "@/lib/locale";
import { getLimits } from "@/lib/settings";

export const metadata = { title: "FAQ" };

export default async function Faq() {
  const ar = (await getLocale()) === "ar";
  const limits = await getLimits().catch(() => null);
  const n = limits?.monthlyInspectionsPerUser ?? 0;
  const secs = limits?.maxVideoSeconds ?? 60;
  const qa: [string, string][] = ar
    ? [
        ["الخدمة مجانية صدق؟", n > 0
          ? `إيه. كل حساب له ${n} فحوصات مجانية بالشهر، لأن كل تحليل يكلّفنا فلوس حقيقية عند مزوّد الذكاء الاصطناعي. وما نطلب منك بطاقة.`
          : "إيه، مجانية بالكامل: لا بطاقة ولا اشتراك ولا عدد محدد لكل حساب. بس عشان نحمي الخدمة من الإساءة فيه حد يومي عام للتحليلات، وإذا اكتمل ترسل فحصك بكرة."],
        ["كم ياخذ التقرير؟", "عادةً دقايق بعد ما ترسل. صفحة الفحص تتحدث لحالها وتفتح التقرير أول ما يجهز، ويبقى محفوظ في حسابك تشوفه وتنزّله PDF متى ما بغيت. وما نرسل التقارير بالإيميل."],
        ["مين يشوف صوري؟", "أنت بس من داخل حسابك. نرسل نسخة منها لمزوّد الذكاء الاصطناعي عشان يحللها، وممكن يطّلع عليها مشرف الخدمة إذا احتاج للدعم أو مراجعة الجودة، وكل اطّلاع من الإدارة متسجّل."],
        ["من وين تجيبون السعر المناسب؟", "وقت الفحص نبحث في الإنترنت عن أسعار نفس الجهاز المعروضة في السعودية (مثل حراج والمتاجر)، ونعدّلها حسب الحالة اللي بانت في الصور، ونعرض لك المصادر. هو تقدير تقريبي مهوب سعر رسمي، وإذا ما لقينا أسعار كافية نقول لك بدال ما نخمّن."],
        ["التقرير يضمن لي حالة الجهاز؟", "لا. هو تحليل للي يبان في الصور بس، وممكن يغلط. يفيدك تعرف وين تركّز، مير ما يغنيك عن إنك تفحص الجهاز بنفسك."],
        ["وش الصور اللي تحتاجونها؟", "4 صور على الأقل في مكان نوره زين وبدون فلاش مباشر: الشاشة من قدّام وهي شغّالة، الظهر، الأطراف والمنافذ، والكاميرات. وإذا تعرف فيه عيب صوّره من قريب."],
        ["أقدر أرفع فيديو؟", `إيه، فيديو واحد إلين ${secs} ثانية. نطلّع منه لقطات ونكتب وقت كل لقطة في التقرير.`],
        ["ليه انرفضت صورتي؟", "نفحص كل ملف. نرفضه إذا ما كان صورة سليمة، أو كان أصغر من 320 بكسل، أو مكرر، أو بصيغة HEIC. في الآيفون اختر «الأكثر توافقاً» من إعدادات الكاميرا."],
        ["وإذا فشل التحليل؟", "ما نطلّع تقرير إلا من تحليل مكتمل. تقدر تعيد المحاولة من صفحة الفحص."],
        ["بأي لغة يطلع التقرير؟", "بالعربي أو الإنجليزي، تختارها يوم تسوي الفحص."],
        ["نسيت كلمة السر، وش أسوي؟", "حنا ما نرسل إيميلات، فيوم تسجّل يطلع لك «رمز استرجاع» مرة وحدة. من «نسيت كلمة السر؟» اكتب إيميلك والرمز وكلمة سر جديدة. وإذا ضيّعت الرمز كلّمنا من نفس إيميلك المسجّل."],
        ["وشلون أحذف بياناتي؟", "من صفحة «حسابي» احذف الحساب، ونحذف كل الصور والفيديوهات والتقارير نهائياً. وتقدر قبلها تنزّل نسخة من بياناتك."],
      ]
    : [
        ["Is it really free?", n > 0
          ? `Yes. Each account gets ${n} free inspections per month, because every analysis has a real cost at the AI provider. No card required.`
          : "Yes, completely: no card, no subscription and no per-account allowance. To protect the service from abuse there is an overall daily limit on analyses; if it is reached, submit again tomorrow."],
        ["How long does a report take?", "Usually a few minutes after you submit. The inspection page updates by itself and opens the report when it is ready; it stays in your account to view or download as a PDF at any time. Reports are not sent by e-mail."],
        ["Who can see my photos?", "Only you, from your account. A copy is sent to the AI provider for analysis, and the service operator may look at them for support or quality review; every admin access is logged."],
        ["Where does the fair price come from?", "At the time of the inspection we search the web for prices of the same device listed in Saudi Arabia (such as Haraj and online stores), adjust for the condition visible in the photos, and show you the sources. It is a rough estimate, not an official price; if we can't find enough prices we say so instead of guessing."],
        ["Is the report a guarantee?", "No. It analyses only what the photos show and it can be wrong. It helps you know where to look; it does not replace checking the device yourself."],
        ["Which photos do you need?", "At least 4 well-lit photos without direct flash: front with the screen on, back, edges and ports, and cameras. Add a close-up of any defect you know about."],
        ["Can I upload a video?", `Yes, one video up to ${secs} seconds. We extract frames and cite each frame's timestamp in the report.`],
        ["Why was my photo rejected?", "We check every file. We reject files that aren't valid images, are smaller than 320 px, are duplicates, or are HEIC. On iPhone choose \"Most Compatible\" in Camera settings."],
        ["What if the analysis fails?", "We never issue a report without a completed analysis. You can retry from the inspection page."],
        ["Which language is the report in?", "Arabic or English; you choose when you create the inspection."],
        ["I forgot my password. What now?", "We do not send e-mail, so when you sign up you get a recovery code, shown once. On \"Forgot your password?\" enter your e-mail, the code and a new password. If you lost the code, write to us from your registered e-mail."],
        ["How do I delete my data?", "Delete your account from the Account page and we permanently remove every photo, video and report. You can download a copy of your data first."],
      ];
  // The recovery-code answer only applies where the site sends no e-mail.
  const shown = emailEnabled() ? qa.filter(([q]) => !q.startsWith("نسيت كلمة السر") && !q.startsWith("I forgot my password")) : qa;
  return (
    <div className="wrap page" style={{ maxWidth: 820 }}>
      <h1>{ar ? "أسئلة تتكرر" : "Frequently asked questions"}</h1>
      <div style={{ marginTop: 20 }}>
        {shown.map(([q, a]) => (
          <details className="faq" key={q}><summary>{q}</summary><p>{a}</p></details>
        ))}
      </div>
      <p style={{ marginTop: 28 }}>{ar ? "سؤالك مهوب هنا؟" : "Question not here?"} <Link href="/contact">{ar ? "كلّمنا" : "Contact us"}</Link></p>
    </div>
  );
}
