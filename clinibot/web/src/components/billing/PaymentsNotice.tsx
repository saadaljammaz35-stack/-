import { Mail, MessageSquareText } from "lucide-react";
import { Link } from "react-router";
import { buttonClasses } from "@/components/ui";
import { useI18n } from "@/i18n";
import { contactEmail } from "./contact";

/**
 * The honest state of payments: there is no checkout in the app. Upgrades and
 * continuing after the trial go through the CliniBot team.
 */
export function PaymentsNotice() {
  const { t } = useI18n();
  const email = contactEmail();
  return (
    <section
      aria-labelledby="payments-notice-title"
      className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-950 sm:px-6"
    >
      <h2 id="payments-notice-title" className="text-base font-extrabold">
        {t("billing.paymentsTitle")}
      </h2>
      <p className="mt-1.5 text-sm leading-relaxed">{t("billing.paymentsText")}</p>
      <p className="mt-1 text-sm leading-relaxed font-bold">{t("billing.paymentsNoCard")}</p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Link
          to={{ pathname: "/", hash: "#contact" }}
          className={buttonClasses({ variant: "primary" })}
        >
          <MessageSquareText className="size-4" aria-hidden="true" />
          {t("billing.contactTeam")}
        </Link>
      </div>
      {email && (
        <p className="mt-3 flex items-center gap-2 text-sm">
          <Mail className="size-4 shrink-0" aria-hidden="true" />
          <a
            href={`mailto:${email}`}
            className="min-w-0 font-bold break-all underline underline-offset-2 hover:no-underline"
          >
            {t("billing.emailTeam", { email })}
          </a>
        </p>
      )}
    </section>
  );
}
