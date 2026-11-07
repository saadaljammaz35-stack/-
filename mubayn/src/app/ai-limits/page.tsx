import { getLocale } from "@/lib/locale";

export const metadata = { title: "AI limits" };

export default async function AiLimits() {
  const ar = (await getLocale()) === "ar";
  return (
    <div className="wrap page prose">
      <h1>{ar ? "وش يقدر يشوف الذكاء الاصطناعي ووش ما يقدر" : "What AI inspection can and cannot do"}</h1>
      <p className="lead">
        {ar
          ? "نبيك تعرف بالضبط وش اللي يعتمد عليه التقرير، عشان تستخدمه في مكانه الصح."
          : "We want you to know exactly what the report rests on, so you can use it for what it is."}
      </p>
      <h2>{ar ? "وشلون يطلع التقرير" : "How a report is made"}</h2>
      <ol>
        {(ar
          ? [
              "نفحص كل ملف ترفعه: نوعه الحقيقي من محتواه، وحجمه، وإنه صورة أو فيديو سليم.",
              "نطلّع لقطات من الفيديو على فترات متساوية، ونحفظ كل لقطة مع وقتها.",
              "نعطي كل دليل رقم (E1، E2…) ونرسل نسخة منه، بعد ما نشيل منها بيانات الموقع، لنموذج Claude من Anthropic مع معلومات الجهاز وكلام البائع.",
              "نطلب من النموذج ما يذكر إلا اللي يشوفه، ويربط كل ملاحظة برقم دليل. وأي ملاحظة ما تأشّر على دليل موجود نشيلها.",
              "إذا فشل التحليل أو جا الرد خربان، ما نطلّع تقرير، ونعيد المحاولة أو نعلمك.",
              "نحفظ الرد كامل وبصمة كل ملف (SHA-256)، عشان كل نتيجة نقدر نرجّعها لمصدرها.",
            ]
          : [
              "We check every file you upload: its real type from its content, its size, and that it is a valid image or video.",
              "We extract evenly spaced frames from videos and keep each frame with its timestamp.",
              "Each piece of evidence gets a label (E1, E2, …) and a copy, with location data removed, is sent to Anthropic's Claude model along with the device details and the seller's claims.",
              "The model is told to report only what it sees and to tie every finding to an evidence label. Findings that don't point to real evidence are discarded.",
              "If the analysis fails or the response is invalid, no report is issued; we retry or tell you.",
              "We keep the full response and a fingerprint (SHA-256) of every file, so every result can be traced to its source.",
            ]
        ).map((x) => <li key={x}>{x}</li>)}
      </ol>
      <h2>{ar ? "أشياء ما تبان من الصور" : "What photos cannot tell you"}</h2>
      <ul>
        {(ar
          ? [
              "صحة البطارية وكم مرة انشحنت.",
              "الأعطال الداخلية وهل كل شي يشتغل: اللمس، السماعات، الكاميرا، الشحن، الشبكة، بصمة الوجه أو الإصبع.",
              "إذا دخله موية، إلا لو بان مؤشر واضح في الصورة.",
              "قفل iCloud أو حساب Google، أو إذا الرقم التسلسلي IMEI محظور، أو إن الجهاز مسروق.",
              "هل القطع أصلية، أو إن الجهاز ما قد انفتح وما تغيّرت شاشته.",
              "عيوب ما تبان بسبب الإضاءة أو الزاوية أو الكفر أو لزقة الحماية.",
            ]
          : [
              "Battery health and charge cycles.",
              "Internal or functional faults: touch, speakers, cameras, charging, network, Face ID or fingerprint.",
              "Water damage, unless an indicator is clearly visible.",
              "iCloud or Google account lock, a blacklisted IMEI, or whether the device is stolen.",
              "Whether parts are original, or the device was opened or had its screen replaced.",
              "Defects hidden by lighting, angle, a case or a screen protector.",
            ]
        ).map((x) => <li key={x}>{x}</li>)}
      </ul>
      <p className="notice">
        {ar
          ? "استخدم التقرير عشان تعرف وين تركّز ووش تسأل البائع، وبعدين افحص الجهاز بنفسك قبل لا تدفع. وكل تقرير فيه قائمة فحوصات عملية لهالشي."
          : "Use the report to know where to look and what to ask the seller, then check the device yourself before paying. Every report includes a practical checklist for that."}
      </p>
    </div>
  );
}
