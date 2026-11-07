import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminAction } from "@/components/admin-client";
import { AdminShell, fmtDate } from "@/components/admin-nav";
import { ReportView } from "@/components/report-view";
import { adminT, reportStatusLabel } from "@/lib/admin-i18n";
import { audit } from "@/lib/audit";
import { AppError } from "@/lib/errors";
import { getLocale } from "@/lib/locale";
import { pageAdmin } from "@/lib/page-auth";
import { getReportForAdmin } from "@/lib/reports";

export const metadata = { title: "Report review", robots: { index: false } };

export default async function AdminReport({ params }: { params: Promise<{ id: string }> }) {
  const admin = await pageAdmin();
  const locale = await getLocale();
  const t = adminT(locale);
  const { id } = await params;
  const full = await getReportForAdmin(id).catch((e) => {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  });
  await audit(admin.user.id, "admin.viewed_report", { type: "report", id });
  const r = full.report;
  return (
    <AdminShell title={t("t_report_review")} locale={locale}>
      <div className="card-flat stack" style={{ marginBottom: 20 }}>
        <div className="row small">
          <Link href={`/admin/inspections/${r.inspection_id}`}>{t("back_inspection")}</Link>
          <span className="chip">{reportStatusLabel(r.status, locale)}</span>
          <span>{r.reviewed_at ? `${t("reviewed_at")} ${fmtDate(r.reviewed_at)}` : t("not_reviewed_short")}</span>
          {r.review_note && <span>{t("note")}: {r.review_note}</span>}
          <span>{t("dropped")}: {r.body.validation?.dropped_findings ?? 0}</span>
        </div>
        <div className="row">
          <AdminAction locale={locale} url={`/api/admin/reports/${r.id}`} body={{ action: "review" }} label={t("mark_reviewed")} withNote="optional" />
          {r.status !== "withdrawn" && <AdminAction locale={locale} url={`/api/admin/reports/${r.id}`} body={{ action: "withdraw" }} label={t("withdraw")} danger withNote="required" />}
        </div>
      </div>
      <ReportView full={full} pdfHref={`/api/reports/${r.id}/pdf`} />
    </AdminShell>
  );
}
