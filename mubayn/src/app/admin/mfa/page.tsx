import { notFound } from "next/navigation";
import { MfaEnrol } from "@/components/admin-client";
import { adminT } from "@/lib/admin-i18n";
import { currentSession } from "@/lib/auth";
import { getLocale } from "@/lib/locale";

export const metadata = { title: "Admin verification", robots: { index: false } };

export default async function AdminMfa() {
  const s = await currentSession();
  if (!s || s.user.role !== "admin") notFound();
  const locale = await getLocale();
  const t = adminT(locale);
  return (
    <div className="auth-shell" dir={locale === "ar" ? "rtl" : "ltr"} lang={locale}>
      <div className="card auth-card">
        <h1 style={{ fontSize: "1.5rem" }}>{t("t_mfa")}</h1>
        <p className="muted">{t("mfa_intro")}</p>
        <MfaEnrol enrolled={Boolean(s.user.mfa_enabled_at)} locale={locale} />
      </div>
    </div>
  );
}
