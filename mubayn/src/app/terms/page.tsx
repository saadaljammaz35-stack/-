import Link from "next/link";
import { LEGAL_UPDATED, business } from "@/lib/business";
import { getLocale } from "@/lib/locale";
import { getLimits } from "@/lib/settings";

export const metadata = { title: "Terms" };

export default async function Terms() {
  const locale = await getLocale();
  const b = business(locale);
  const limits = await getLimits().catch(() => null);
  const n = limits?.monthlyInspectionsPerUser ?? 0;
  if (locale === "ar") {
    return (
      <div className="wrap page prose">
        <h1>الشروط والأحكام</h1>
        <p className="muted">آخر تحديث: {LEGAL_UPDATED}</p>
        {!b.complete && <p className="notice">بيانات المشغّل لم تُستكمل بعد. هذه المسودة يجب أن يراجعها مختص قانوني قبل الإطلاق التجاري.</p>}
        <h2>1. الخدمة</h2>
        <p>«مُبيّن» خدمة تحلل الصور ومقاطع الفيديو التي ترفعها لجهاز إلكتروني مستعمل باستخدام الذكاء الاصطناعي، وتصدر تقريراً عن الحالة الظاهرة في تلك الأدلة. يقدمها: {b.name}.</p>
        <h2>2. الخدمة مجانية</h2>
        <p>الخدمة مجانية حالياً{n > 0 ? `، ولكل حساب ${n} فحوصات شهرياً` : " دون حد شهري لكل حساب"}. قد نضع سقفاً يومياً عاماً أو نوقف استقبال الفحوصات مؤقتاً لحماية الخدمة من الإساءة وللحفاظ على جودتها، وننشر أي حدود في الموقع.</p>
        <h2>3. حدود التقرير، وهذا أهم بند</h2>
        <p>التقرير تحليل آلي لما يظهر في الأدلة التي رفعتها فقط. ليس فحصاً فنياً مباشراً، ولا شهادة، ولا ضماناً لحالة الجهاز أو أصالته أو سلامته الداخلية أو خلوّه من القفل أو الحظر. قد يخطئ التحليل أو يفوّت عيباً، وتتأثر النتيجة بجودة الصور. أنت مسؤول عن قرار الشراء أو البيع، وننصحك بفحص الجهاز بنفسك. التفاصيل في صفحة <Link href="/ai-limits">حدود الفحص بالذكاء الاصطناعي</Link>.</p>
        <h2>4. حسابك</h2>
        <p>قدّم بيانات صحيحة، وحافظ على سرية كلمة المرور، وأخبرنا فوراً عن أي استخدام غير مصرح به. الخدمة لمن أعمارهم 18 عاماً فأكثر، ومن هم أصغر يستخدمونها بموافقة وليّ الأمر.</p>
        <h2>5. ما ترفعه</h2>
        <p>ارفع فقط صوراً ومقاطع لديك حق استخدامها. لا ترفع صوراً لأشخاص أو وثائق هوية أو بيانات شخصية لغيرك. تمنحنا إذناً محدوداً بتخزين الأدلة ومعالجتها وإرسالها لمزوّد الذكاء الاصطناعي بغرض إصدار تقريرك فقط. تبقى ملكية صورك لك.</p>
        <h2>6. الاستخدام المقبول</h2>
        <p>يُمنع: محاولة الوصول لبيانات غيرك، أو إساءة استخدام الخدمة آلياً، أو التحايل على الحدود بحسابات متعددة، أو رفع محتوى مخالف للأنظمة، أو استخدام التقرير لتضليل مشترٍ. يحق لنا إيقاف الحساب المخالف.</p>
        <h2>7. التوفر والتغييرات</h2>
        <p>نسعى لتشغيل الخدمة باستمرار، لكن قد تتوقف أو يتأخر التحليل. إذا فشل التحليل لا نصدر تقريراً، ويمكنك إعادة المحاولة. قد نعدّل الخدمة أو هذه الشروط، وننشر التعديل هنا.</p>
        <h2>8. المسؤولية</h2>
        <p>في حدود ما تسمح به الأنظمة المطبقة، لا نتحمل مسؤولية أي خسارة تنتج عن الاعتماد على التقرير في قرار شراء أو بيع، والخدمة مقدمة «كما هي» دون ضمانات.</p>
        <h2>9. الإنهاء</h2>
        <p>يمكنك حذف حسابك في أي وقت من صفحة «حسابي». ويحق لنا إنهاء الحسابات المخالفة لهذه الشروط.</p>
        <h2>10. النظام المطبق</h2>
        <p>تخضع هذه الشروط لأنظمة الدولة التي يُسجَّل فيها المشغّل ({b.country}). التواصل: <span dir="ltr">{b.email}</span>.</p>
      </div>
    );
  }
  return (
    <div className="wrap page prose">
      <h1>Terms of service</h1>
      <p className="muted">Last updated: {LEGAL_UPDATED}</p>
      {!b.complete && <p className="notice">The operator details are not complete yet. This draft must be reviewed by a qualified lawyer before commercial launch.</p>}
      <h2>1. The service</h2>
      <p>MUBAYN uses AI to analyse the photos and videos you upload of a used electronic device and issues a report on the condition visible in that evidence. It is provided by {b.name}.</p>
      <h2>2. Free, within limits</h2>
      <p>The service is currently free{n > 0 ? `, with ${n} inspections per account each month` : ", with no monthly limit per account"}. We may set an overall daily cap or pause new inspections to protect the service from abuse and keep it reliable, and we will publish any limits on the site.</p>
      <h2>3. What the report is, and is not (the most important clause)</h2>
      <p>The report is an automated analysis of what is visible in the evidence you uploaded, and nothing else. It is not a hands-on technical inspection, a certification, or a guarantee of the device's condition, authenticity, internal health, or freedom from locks or blacklisting. The analysis can be wrong or miss defects, and its quality depends on your photos. You are responsible for your buying or selling decision, and we recommend checking the device yourself. Details: <Link href="/ai-limits">What AI inspection can and cannot do</Link>.</p>
      <h2>4. Your account</h2>
      <p>Give accurate details, keep your password secret, and tell us at once about unauthorised use. The service is for people aged 18 or over; younger people need a parent or guardian's consent.</p>
      <h2>5. What you upload</h2>
      <p>Upload only photos and videos you have the right to use. Do not upload pictures of people, identity documents, or other people's personal data. You grant us a limited permission to store and process the evidence and send it to our AI provider solely to produce your report. You keep ownership of your photos.</p>
      <h2>6. Acceptable use</h2>
      <p>Do not try to access other people's data, abuse the service with automation, get around the limits with multiple accounts, upload unlawful content, or use a report to mislead a buyer. We may suspend accounts that do.</p>
      <h2>7. Availability and changes</h2>
      <p>We aim to keep the service running, but it can stop or analyses can be delayed. If an analysis fails we do not issue a report, and you can retry. We may change the service or these terms and will publish changes here.</p>
      <h2>8. Liability</h2>
      <p>To the extent applicable law allows, we are not liable for any loss arising from relying on a report in a buying or selling decision. The service is provided "as is", without warranties.</p>
      <h2>9. Ending</h2>
      <p>You can delete your account at any time from your Account page. We may close accounts that break these terms.</p>
      <h2>10. Governing law</h2>
      <p>These terms are governed by the laws of the country where the operator is registered ({b.country}). Contact: <span dir="ltr">{b.email}</span>.</p>
    </div>
  );
}
