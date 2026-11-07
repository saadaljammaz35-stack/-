import { ChangePassword, DeleteAccount, RegenerateRecoveryCode } from "@/components/account-client";
import { emailEnabled } from "@/lib/config";
import { one } from "@/lib/db";
import { translator } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { pageUser } from "@/lib/page-auth";

export const metadata = { title: "Account", robots: { index: false } };

export default async function Account() {
  const s = await pageUser("/account");
  const locale = await getLocale();
  const t = translator(locale);
  const noEmail = !emailEnabled();
  const rc = noEmail ? await one<{ created: Date | null }>(`SELECT recovery_code_created_at AS created FROM users WHERE id = $1`, [s.user.id]) : null;
  const date = new Intl.DateTimeFormat(locale === "ar" ? "ar-SA-u-nu-latn-ca-gregory" : "en-GB", { dateStyle: "medium", timeStyle: "short" });
  return (
    <div className="wrap page stack" style={{ maxWidth: 760 }}>
      <h1 style={{ fontSize: "2rem" }}>{t("acc_title")}</h1>
      <div className="card-flat"><strong>{s.user.full_name}</strong><div className="mono">{s.user.email}</div></div>
      <section className="card"><h2 style={{ fontSize: "1.25rem" }}>{t("acc_change_pw")}</h2><ChangePassword locale={locale} /></section>
      {noEmail && (
        <section className="card" id="recovery">
          <h2 style={{ fontSize: "1.25rem" }}>{t("acc_rc_title")}</h2>
          <p className="small muted">{rc?.created ? <>{t("acc_rc_since")} <bdi>{date.format(rc.created)}</bdi>. {t("acc_rc_sub")}</> : t("acc_rc_none")}</p>
          <RegenerateRecoveryCode locale={locale} />
        </section>
      )}
      <section className="card"><h2 style={{ fontSize: "1.25rem" }}>{t("acc_export")}</h2><a className="btn btn-ghost" href="/api/account/export">{t("acc_export")}</a></section>
      <section className="card" style={{ borderColor: "#f5c2bd" }}><h2 style={{ fontSize: "1.25rem" }}>{t("acc_delete")}</h2><DeleteAccount locale={locale} /></section>
    </div>
  );
}
