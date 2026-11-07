import { LimitsForm } from "@/components/admin-client";
import { AdminShell } from "@/components/admin-nav";
import { adminT } from "@/lib/admin-i18n";
import { config } from "@/lib/config";
import { getLocale } from "@/lib/locale";
import { pageAdmin } from "@/lib/page-auth";
import { getLimits } from "@/lib/settings";

export const metadata = { title: "Limits", robots: { index: false } };

export default async function AdminSettings() {
  await pageAdmin();
  const locale = await getLocale();
  const t = adminT(locale);
  const limits = await getLimits();
  const c = config();
  return (
    <AdminShell title={t("t_limits")} locale={locale}>
      <p className="muted">{t("limits_intro")} <span className="mono">{c.AI_MODEL}</span> ({c.AI_EFFORT}). {t("limits_watch")}</p>
      <div className="card"><LimitsForm initial={limits} locale={locale} /></div>
    </AdminShell>
  );
}
