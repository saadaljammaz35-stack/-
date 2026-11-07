"use client";
import { useState } from "react";
import type { Locale } from "@/lib/i18n";
import { api } from "./api";
import { errorText } from "./errors";

export function ContactForm({ locale }: { locale: Locale }) {
  const ar = locale === "ar";
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (done) return <div className="alert alert-ok" role="status">{ar ? "وصلتنا رسالتك، وبنرد عليك على إيميلك." : "We received your message and will reply by e-mail."}</div>;
  return (
    <form method="post" className="form" onSubmit={async (e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      setBusy(true);
      const r = await api("POST", "/api/contact", { name: f.get("name"), email: f.get("email"), subject: f.get("subject"), message: f.get("message") });
      setBusy(false);
      if (r.ok) setDone(true); else setError(errorText(r.error, locale));
    }}>
      <div className="grid-2">
        <div className="field"><label htmlFor="name">{ar ? "اسمك" : "Name"}</label><input id="name" name="name" required maxLength={100} /></div>
        <div className="field"><label htmlFor="email">{ar ? "إيميلك" : "E-mail"}</label><input id="email" name="email" type="email" required dir="ltr" /></div>
      </div>
      <div className="field"><label htmlFor="subject">{ar ? "الموضوع" : "Subject"}</label><input id="subject" name="subject" required maxLength={150} /></div>
      <div className="field"><label htmlFor="message">{ar ? "وش تبي تقول" : "Message"}</label><textarea id="message" name="message" required minLength={10} maxLength={5000} /></div>
      {error && <div className="alert alert-error">{error}</div>}
      <div><button className="btn" disabled={busy}>{ar ? "أرسل" : "Send"}</button></div>
    </form>
  );
}
