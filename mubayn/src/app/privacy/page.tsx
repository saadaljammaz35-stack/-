import { LEGAL_UPDATED, business } from "@/lib/business";
import { getLocale } from "@/lib/locale";

export const metadata = { title: "Privacy" };

export default async function Privacy() {
  const locale = await getLocale();
  const b = business(locale);
  if (locale === "ar") {
    return (
      <div className="wrap page prose">
        <h1>سياسة الخصوصية</h1>
        <p className="muted">آخر تحديث: {LEGAL_UPDATED}</p>
        {!b.complete && <p className="notice">بيانات المشغّل أدناه لم تُستكمل بعد. هذه المسودة يجب أن يراجعها مختص قانوني قبل الإطلاق التجاري.</p>}
        <h2>من نحن</h2>
        <p>تقدّم خدمة «مُبيِّن» (MUBAYN) الجهة: {b.name}، رقم السجل/الوثيقة: {b.cr}، العنوان: {b.address}. للتواصل في شؤون الخصوصية: <span dir="ltr">{b.email}</span>.</p>
        <h2>البيانات التي نجمعها</h2>
        <ul>
          <li>بيانات الحساب: الاسم، البريد الإلكتروني، وكلمة المرور مخزنة بشكل مُجزَّأ (scrypt) ولا نستطيع قراءتها.</li>
          <li>بيانات الفحص: نوع الجهاز وموديله وما تكتبه من ادعاءات البائع.</li>
          <li>الأدلة: الصور ومقاطع الفيديو التي ترفعها، ولقطات نستخرجها من الفيديو، ونسخ مصغّرة نرسلها للتحليل بعد إزالة بيانات الموقع منها.</li>
          <li>نتائج التحليل: رد مزوّد الذكاء الاصطناعي كاملاً والتقرير والملاحظات، لنتمكن من تتبع كل نتيجة إلى دليلها.</li>
          <li>بيانات تقنية وأمنية: عنوان IP ونوع المتصفح عند تسجيل الدخول والإجراءات الحساسة، لحماية الحسابات ومنع إساءة الاستخدام.</li>
        </ul>
        <h2>لماذا نستخدمها</h2>
        <p>لتقديم الخدمة التي تطلبها (تحليل الأدلة وإصدار التقرير)، ولتأمين حسابك، ولمنع إساءة الاستخدام، وللرد على استفساراتك. لا نبيع بياناتك، ولا نستخدم صورك في الإعلانات، ولا ندرّب نماذج ذكاء اصطناعي عليها.</p>
        <h2>من يعالج بياناتك نيابة عنا</h2>
        <ul>
          <li>مزوّد الذكاء الاصطناعي Anthropic (الولايات المتحدة) لتحليل الصور. وفق شروطه التجارية لا يستخدم بيانات واجهة البرمجة لتدريب نماذجه.</li>
          <li>مزوّد الاستضافة وقاعدة البيانات والتخزين السحابي الذي يحدده المشغّل، وقد يكون خارج المملكة.</li>
          <li>مزوّد البريد الإلكتروني لإرسال رسائل التأكيد واستعادة كلمة المرور وإشعار جاهزية التقرير.</li>
        </ul>
        <p>قد يعني ذلك نقل بياناتك خارج بلدك. نعتمد في ذلك على موافقتك وعلى ضرورة النقل لتقديم الخدمة، وفق نظام حماية البيانات الشخصية في المملكة العربية السعودية والأنظمة المطبقة الأخرى.</p>
        <h2>مدة الاحتفاظ</h2>
        <p>نحتفظ بالأدلة والتقارير حتى تحذف الفحص (قبل إرساله) أو تحذف حسابك. عند حذف الحساب نحذف نهائياً الحساب وكل الصور والفيديوهات والتقارير المرتبطة به. نحتفظ بسجلات أمنية مختصرة لا تحتوي بياناتك الشخصية.</p>
        <h2>حقوقك</h2>
        <ul>
          <li>الاطلاع: نزّل نسخة من بياناتك من صفحة «حسابي».</li>
          <li>التصحيح: عدّل بيانات الفحص قبل إرساله، أو راسلنا.</li>
          <li>الحذف: احذف حسابك وكل بياناته من صفحة «حسابي» في أي وقت.</li>
          <li>الاعتراض والشكوى: راسلنا على البريد أعلاه، ويحق لك تقديم شكوى للجهة الرقابية المختصة في بلدك.</li>
        </ul>
        <h2>الأمان</h2>
        <p>نستخدم اتصالاً مشفراً (HTTPS)، وتخزيناً خاصاً لا يُفتح إلا بروابط مؤقتة بعد التحقق من صاحب الملف، وتحققاً ثنائياً لحسابات الإدارة، وسجلاً لكل إجراء إداري.</p>
        <h2>العمر</h2>
        <p>الخدمة موجهة لمن أعمارهم 18 عاماً فأكثر. من هم أصغر سناً يجب أن يستخدموها بموافقة وليّ الأمر وإشرافه.</p>
        <h2>التغييرات</h2>
        <p>سننشر أي تعديل على هذه الصفحة مع تاريخ التحديث، ونبلغك بالبريد إذا كان التعديل جوهرياً.</p>
      </div>
    );
  }
  return (
    <div className="wrap page prose">
      <h1>Privacy policy</h1>
      <p className="muted">Last updated: {LEGAL_UPDATED}</p>
      {!b.complete && <p className="notice">The operator details below are not complete yet. This draft must be reviewed by a qualified lawyer before commercial launch.</p>}
      <h2>Who we are</h2>
      <p>MUBAYN is provided by {b.name}, registration: {b.cr}, address: {b.address}. Privacy contact: <span dir="ltr">{b.email}</span>.</p>
      <h2>What we collect</h2>
      <ul>
        <li>Account data: name, e-mail, and your password stored as a scrypt hash we cannot read.</li>
        <li>Inspection data: device type and model, and the seller claims you enter.</li>
        <li>Evidence: photos and videos you upload, frames we extract from videos, and resized copies sent for analysis with location metadata removed.</li>
        <li>Analysis results: the AI provider's full response, the report and findings, so every result can be traced to its evidence.</li>
        <li>Security data: IP address and browser type at sign-in and on sensitive actions, to protect accounts and prevent abuse.</li>
      </ul>
      <h2>Why we use it</h2>
      <p>To provide the service you ask for (analysing evidence and producing the report), to secure your account, to prevent abuse, and to answer you. We do not sell your data, use your photos for advertising, or train AI models on them.</p>
      <h2>Who processes data for us</h2>
      <ul>
        <li>Anthropic (United States), the AI provider that analyses the images. Under its commercial terms it does not train its models on API data.</li>
        <li>The hosting, database and cloud storage providers chosen by the operator, which may be outside your country.</li>
        <li>An e-mail provider for confirmation, password-reset and report-ready messages.</li>
      </ul>
      <p>This can mean your data is transferred outside your country. We rely on your consent and on the transfer being necessary to provide the service, under Saudi Arabia's Personal Data Protection Law and other applicable laws.</p>
      <h2>Retention</h2>
      <p>Evidence and reports are kept until you delete the inspection (before submitting) or delete your account. Deleting your account permanently removes it and every photo, video and report linked to it. We keep brief security logs that contain no personal data.</p>
      <h2>Your rights</h2>
      <ul>
        <li>Access: download a copy of your data from your Account page.</li>
        <li>Correction: edit inspection details before submitting, or write to us.</li>
        <li>Deletion: delete your account and all its data from your Account page at any time.</li>
        <li>Objection and complaints: write to us at the address above. You may also complain to the data protection authority in your country.</li>
      </ul>
      <h2>Security</h2>
      <p>Encrypted connections (HTTPS), private storage opened only through short-lived links after ownership is checked, two-factor authentication for administrators, and a log of every administrative action.</p>
      <h2>Age</h2>
      <p>The service is meant for people aged 18 or over. Younger people must use it with a parent or guardian's consent and supervision.</p>
      <h2>Changes</h2>
      <p>We will publish any change on this page with its date, and e-mail you about material changes.</p>
    </div>
  );
}
