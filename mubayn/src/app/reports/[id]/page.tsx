import Link from "next/link";
import { notFound } from "next/navigation";
import { ReportView } from "@/components/report-view";
import { AppError } from "@/lib/errors";
import { translator } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { pageUser } from "@/lib/page-auth";
import { getOwnedReport } from "@/lib/reports";

export const metadata = { title: "Report", robots: { index: false } };

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await pageUser(`/reports/${id}`);
  const locale = await getLocale();
  const full = await getOwnedReport(s.user.id, id).catch((e) => {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  });
  return (
    <div className="wrap page" style={{ maxWidth: 980 }}>
      <Link href="/dashboard" className="small">← {translator(locale)("nav_dashboard")}</Link>
      <div style={{ marginTop: 10 }}><ReportView full={full} pdfHref={`/api/reports/${full.report.id}/pdf`} /></div>
    </div>
  );
}
