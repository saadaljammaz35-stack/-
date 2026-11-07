import { ContactForm } from "@/components/contact-form";
import { getLocale } from "@/lib/locale";

export const metadata = { title: "Contact" };

export default async function Contact() {
  const locale = await getLocale();
  const ar = locale === "ar";
  const email = process.env.SUPPORT_EMAIL;
  return (
    <div className="wrap page" style={{ maxWidth: 760 }}>
      <h1>{ar ? "تواصل معنا" : "Contact us"}</h1>
      <p className="muted">
        {ar ? "للدعم أو الخصوصية أو الإبلاغ عن مشكلة في تقرير. اذكر رقم التقرير إن وُجد." : "For support, privacy, or a problem with a report. Include the report number if you have one."}
        {email && <> {ar ? "أو راسلنا مباشرة:" : "Or e-mail us directly:"} <a href={`mailto:${email}`} dir="ltr">{email}</a></>}
      </p>
      <div className="card"><ContactForm locale={locale} /></div>
    </div>
  );
}
