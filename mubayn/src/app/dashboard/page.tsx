import Link from "next/link";
import { ResendVerification } from "@/components/inspection-client";
import { StatusChip } from "@/components/status";
import { emailEnabled } from "@/lib/config";
import { one } from "@/lib/db";
import { translator } from "@/lib/i18n";
import { listInspections, quotaFor } from "@/lib/inspections";
import { getLocale } from "@/lib/locale";
import { pageUser } from "@/lib/page-auth";

export const metadata = { title: "Dashboard", robots: { index: false } };

export default async function Dashboard() {
  const s = await pageUser("/dashboard");
  const locale = await getLocale();
  const t = translator(locale);
  const noEmail = !emailEnabled();
  const [items, quota, rc] = await Promise.all([
    listInspections(s.user.id),
    quotaFor(s.user.id),
    noEmail ? one<{ has: boolean }>(`SELECT recovery_code_hash IS NOT NULL AS has FROM users WHERE id = $1`, [s.user.id]) : null,
  ]);
  const date = new Intl.DateTimeFormat(locale === "ar" ? "ar-SA-u-nu-latn-ca-gregory" : "en-GB", { dateStyle: "medium" });
  return (
    <div className="wrap page">
      {noEmail && rc && !rc.has && (
        <div className="alert alert-warn spread" style={{ marginBottom: 20 }}>
          <span>{t("dash_no_rc")}</span>
          <Link href="/account#recovery">{t("dash_no_rc_link")}</Link>
        </div>
      )}
      {!noEmail && !s.user.email_verified_at && (
        <div className="alert alert-warn spread" style={{ marginBottom: 20 }}>
          <span>{t("verify_banner")}</span>
          <ResendVerification locale={locale} />
        </div>
      )}
      <div className="spread page-head">
        <h1 style={{ fontSize: "2rem", margin: 0 }}>{t("dash_title")}</h1>
        <div className="row">
          <span className="chip">{t("quota_left")}: {quota.remaining} / {quota.limit}</span>
          <Link className="btn btn-signal" href="/inspections/new">{t("dash_new")}</Link>
        </div>
      </div>
      {items.length === 0 ? (
        <div className="card" style={{ textAlign: "center" }}>
          <p>{t("dash_empty")}</p>
          <Link className="btn btn-signal" href="/inspections/new">{t("dash_new")}</Link>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>{t("f_model")}</th><th>{t("f_category")}</th><th></th><th></th><th></th></tr></thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id}>
                  <td><strong>{i.brand} {i.model}</strong><div className="small muted">{date.format(i.created_at)}</div></td>
                  <td>{t(`cat_${i.device_category}` as Parameters<typeof t>[0])}</td>
                  <td><StatusChip status={i.status} locale={locale} /></td>
                  <td>{i.condition_score != null ? <span className="mono">{i.condition_score}/100</span> : null}</td>
                  <td style={{ textAlign: "end" }}>
                    {i.report_id
                      ? <Link className="btn btn-sm" href={`/reports/${i.report_id}`}>{t("view_report")}</Link>
                      : <Link className="btn btn-sm btn-ghost" href={`/inspections/${i.id}`}>{t("continue_draft")}</Link>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
