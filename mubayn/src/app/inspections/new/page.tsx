import { DeviceForm } from "@/components/inspection-client";
import { translator } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { pageUser } from "@/lib/page-auth";

export const metadata = { title: "New inspection", robots: { index: false } };

export default async function NewInspection() {
  await pageUser("/inspections/new");
  const locale = await getLocale();
  const t = translator(locale);
  return (
    <div className="wrap page" style={{ maxWidth: 820 }}>
      <span className="eyebrow">1 / 3</span>
      <h1 style={{ fontSize: "2rem" }}>{t("insp_new_title")}</h1>
      <p className="muted">{t("insp_new_sub")}</p>
      <div className="card"><DeviceForm locale={locale} /></div>
    </div>
  );
}
