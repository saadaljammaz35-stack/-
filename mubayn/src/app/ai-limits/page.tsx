import { getLocale } from "@/lib/locale";

export const metadata = { title: "AI limits" };

export default async function AiLimits() {
  const ar = (await getLocale()) === "ar";
  return (
    <div className="wrap page prose">
      <h1>{ar ? "حدود الفحص بالذكاء الاصطناعي" : "What AI inspection can and cannot do"}</h1>
      <p className="lead">
        {ar
          ? "نريدك أن تعرف بالضبط على ماذا يعتمد التقرير، حتى تستخدمه في مكانه الصحيح."
          : "We want you to know exactly what the report rests on, so you can use it for what it is."}
      </p>
      <h2>{ar ? "كيف يُصنع التقرير" : "How a report is made"}</h2>
      <ol>
        {(ar
          ? [
              "نتحقق من كل ملف ترفعه: نوعه الحقيقي من محتواه، وحجمه، وأنه صورة أو فيديو صالح.",
              "نستخرج لقطات من الفيديو بتوقيتات متساوية، ونحفظ كل لقطة مع توقيتها.",
              "نرقّم كل دليل (E1، E2…) ونرسل نسخة منه، بعد إزالة بيانات الموقع، إلى نموذج Claude من Anthropic مع بيانات الجهاز وادعاءات البائع.",
              "نطلب من النموذج ألا يذكر إلا ما يراه، وأن يربط كل ملاحظة برقم دليل. نرفض أي ملاحظة لا تشير إلى دليل موجود.",
              "إذا فشل التحليل أو جاء الرد غير صالح، لا نصدر تقريراً، ونعيد المحاولة أو نخبرك.",
              "نحفظ الرد الكامل وبصمة كل ملف (SHA-256)، فيمكن تتبع كل نتيجة إلى مصدرها.",
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
      <h2>{ar ? "ما لا يمكن معرفته من الصور" : "What photos cannot tell you"}</h2>
      <ul>
        {(ar
          ? [
              "صحة البطارية وعدد دورات الشحن.",
              "الأعطال الداخلية والوظيفية: اللمس، السماعات، الكاميرا، الشحن، الشبكة، بصمة الوجه أو الإصبع.",
              "دخول الماء، إلا إذا ظهر مؤشر واضح في الصورة.",
              "قفل iCloud أو حساب Google، أو حظر الرقم التسلسلي IMEI، أو أن الجهاز مسروق.",
              "أصالة القطع أو أن الجهاز لم يُفتح أو لم تُستبدل شاشته.",
              "عيوب لا تظهر بسبب الإضاءة أو الزاوية أو الغطاء أو لاصق الحماية.",
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
          ? "استخدم التقرير لتعرف أين تنظر ومتى تسأل البائع، ثم افحص الجهاز بنفسك قبل الدفع. كل تقرير يتضمن قائمة فحوصات عملية لهذا الغرض."
          : "Use the report to know where to look and what to ask the seller, then check the device yourself before paying. Every report includes a practical checklist for that."}
      </p>
    </div>
  );
}
