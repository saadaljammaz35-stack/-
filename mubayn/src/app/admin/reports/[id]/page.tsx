import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminAction } from "@/components/admin-client";
import { AdminShell, fmtDate } from "@/components/admin-nav";
import { ReportView } from "@/components/report-view";
import { audit } from "@/lib/audit";
import { AppError } from "@/lib/errors";
import { pageAdmin } from "@/lib/page-auth";
import { getReportForAdmin } from "@/lib/reports";

export const metadata = { title: "Report review", robots: { index: false } };

export default async function AdminReport({ params }: { params: Promise<{ id: string }> }) {
  const admin = await pageAdmin();
  const { id } = await params;
  const full = await getReportForAdmin(id).catch((e) => {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  });
  await audit(admin.user.id, "admin.viewed_report", { type: "report", id });
  const r = full.report;
  return (
    <AdminShell title="Report review">
      <div className="card-flat stack" style={{ marginBottom: 20 }}>
        <div className="row small">
          <Link href={`/admin/inspections/${r.inspection_id}`}>← inspection</Link>
          <span className="chip">{r.status}</span>
          <span>{r.reviewed_at ? `reviewed ${fmtDate(r.reviewed_at)}` : "not reviewed"}</span>
          {r.review_note && <span>note: {r.review_note}</span>}
          <span>dropped findings (no valid evidence): {r.body.validation?.dropped_findings ?? 0}</span>
        </div>
        <div className="row">
          <AdminAction url={`/api/admin/reports/${r.id}`} body={{ action: "review" }} label="Mark reviewed" withNote="optional" />
          {r.status !== "withdrawn" && <AdminAction url={`/api/admin/reports/${r.id}`} body={{ action: "withdraw" }} label="Withdraw report" danger withNote="required" />}
        </div>
      </div>
      <ReportView full={full} pdfHref={`/api/reports/${r.id}/pdf`} />
    </AdminShell>
  );
}
