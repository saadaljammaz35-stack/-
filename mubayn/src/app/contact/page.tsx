import { ContactForm } from "@/components/contact-form";
import { getLocale } from "@/lib/locale";

export const metadata = { title: "Contact" };

export default async function Contact() {
  const locale = await getLocale();
  const ar = locale === "ar";
  const email = process.env.SUPPORT_EMAIL;
  return (
    <div className="wrap page" style={{ maxWidth: 760 }}>
      <h1>{ar ? "كلّمنا" : "Contact us"}</h1>
      <p className="muted">
        {ar ? "لأي سؤال أو مشكلة في تقرير أو شي يخص خصوصيتك، اكتب لنا. وإذا عندك رقم التقرير اذكره." : "For support, privacy, or a problem with a report. Include the report number if you have one."}
        {email && <> {ar ? "أو راسلنا على طول:" : "Or e-mail us directly:"} <a href={`mailto:${email}`} dir="ltr">{email}</a></>}
      </p>
      <div className="card"><ContactForm locale={locale} /></div>
    </div>
  );
}
