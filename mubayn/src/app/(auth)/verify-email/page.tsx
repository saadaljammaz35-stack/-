import { Suspense } from "react";
import { VerifyEmail } from "@/components/auth-forms";
import { translator } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";

export const metadata = { robots: { index: false } };

export default async function Page() {
  const locale = await getLocale();
  const t = translator(locale);
  return (
    <div className="auth-shell">
      <div className="card auth-card reveal">
        <h1 style={{ fontSize: "1.7rem" }}>{t("brand")}</h1>
        
        <Suspense><VerifyEmail locale={locale} /></Suspense>
      </div>
    </div>
  );
}
