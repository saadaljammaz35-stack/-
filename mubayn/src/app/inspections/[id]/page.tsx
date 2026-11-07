import Link from "next/link";
import { redirect } from "next/navigation";
import { DeviceForm, EvidenceUploader, RetryButton, StatusPoller, SubmitPanel } from "@/components/inspection-client";
import { StatusChip } from "@/components/status";
import { translator } from "@/lib/i18n";
import { MIN_IMAGES, getOwnedInspection, listEvidence, quotaFor, readyCounts } from "@/lib/inspections";
import { getLocale } from "@/lib/locale";
import { pageUser } from "@/lib/page-auth";
import { latestReportId } from "@/lib/reports";
import { AppError } from "@/lib/errors";
import { notFound } from "next/navigation";

export const metadata = { title: "Inspection", robots: { index: false } };

export default async function InspectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await pageUser(`/inspections/${id}`);
  const locale = await getLocale();
  const t = translator(locale);
  const insp = await getOwnedInspection(s.user.id, id).catch((e) => {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  });
  if (insp.status === "completed") {
    const rid = await latestReportId(id);
    if (rid) redirect(`/reports/${rid}`);
  }
  const [evidence, counts, quota] = await Promise.all([listEvidence(s.user.id, id), readyCounts(id), quotaFor(s.user.id)]);
  const editable = insp.status === "draft";
  return (
    <div className="wrap page" style={{ maxWidth: 980 }}>
      <div className="spread page-head">
        <div>
          <Link href="/dashboard" className="small">← {t("nav_dashboard")}</Link>
          <h1 style={{ fontSize: "2rem", margin: "6px 0 0" }}>{insp.brand} {insp.model}</h1>
        </div>
        <StatusChip status={insp.status} locale={locale} />
      </div>

      {(insp.status === "queued" || insp.status === "analyzing") && (
        <div className="card stack" role="status" aria-live="polite">
          <h2 style={{ fontSize: "1.3rem" }}>{t("progress_title")}</h2>
          <p className="muted">{t("progress_sub")}</p>
          <div className="bar"><i style={{ width: insp.status === "analyzing" ? "66%" : "20%" }} /></div>
          <StatusPoller inspectionId={id} status={insp.status} />
        </div>
      )}

      {insp.status === "failed" && (
        <div className="card stack">
          <h2 style={{ fontSize: "1.3rem" }}>{t("failed_title")}</h2>
          <p className="muted">{t("failed_sub")}</p>
          <RetryButton locale={locale} inspectionId={id} />
        </div>
      )}

      <div className="stack" style={{ marginTop: 24 }}>
        {editable && (
          <section className="card">
            <h2 style={{ fontSize: "1.3rem" }}>{t("insp_new_title")}</h2>
            <DeviceForm
              locale={locale}
              inspectionId={id}
              initial={{
                deviceCategory: insp.device_category, brand: insp.brand, model: insp.model, storage: insp.storage, color: insp.color,
                purchaseContext: insp.purchase_context, sellerClaims: insp.seller_claims, askingPrice: insp.asking_price, reportLanguage: insp.report_language,
              }}
            />
          </section>
        )}
        <section className="card" id="evidence">
          <h2 style={{ fontSize: "1.3rem" }}>{t("ev_title")}</h2>
          {editable && <p className="muted">{t("ev_guide")}</p>}
          <EvidenceUploader
            locale={locale}
            inspectionId={id}
            editable={editable}
            initial={evidence.map((e) => ({ id: e.id, kind: e.kind, status: e.status, label: e.label, filename: e.original_filename, durationMs: e.duration_ms }))}
          />
        </section>
        {editable && (
          <SubmitPanel
            locale={locale}
            inspectionId={id}
            canSubmit={counts.images >= MIN_IMAGES && counts.pending === 0}
            remaining={quota.remaining}
            verified={Boolean(s.user.email_verified_at)}
          />
        )}
      </div>
    </div>
  );
}
