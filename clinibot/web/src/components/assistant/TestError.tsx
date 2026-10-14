import { Alert, ButtonLink } from "@/components/ui";
import { QueryError } from "@/components/layout/QueryError";
import { useI18n } from "@/i18n";
import { errorReference, errorText } from "@/lib/errors";
import { classifyTestError } from "./model";
import { NotConfiguredPanel } from "./NotConfiguredPanel";

/** Explains why a test message failed and what to do next. */
export function TestError({ error }: { error: unknown }) {
  const { t } = useI18n();
  const reference = errorReference(error);
  const referenceLine = reference ? (
    <span className="mt-1 block text-xs opacity-80">
      {t("errors.reference", { id: reference })}
    </span>
  ) : null;

  switch (classifyTestError(error)) {
    case "not_configured":
      return <NotConfiguredPanel headingLevel={3} />;
    case "billing":
      return (
        <Alert
          tone="warning"
          title={t("assistant.testBillingTitle")}
          action={
            <ButtonLink to="/app/billing" size="sm" variant="outline">
              {t("assistant.goToBilling")}
            </ButtonLink>
          }
        >
          {errorText(t, error)} {t("assistant.testBillingText")}
        </Alert>
      );
    case "key_rejected":
      return (
        <Alert tone="error" title={t("assistant.keyRejectedTitle")}>
          {t("assistant.keyRejectedText")}
          {referenceLine}
        </Alert>
      );
    case "upstream":
      return (
        <Alert tone="error" title={t("assistant.upstreamTitle")}>
          {t("assistant.upstreamText")}
          {referenceLine}
        </Alert>
      );
    case "rate_limited":
      return (
        <Alert tone="warning" title={t("assistant.rateLimitedTitle")}>
          {errorText(t, error)}
        </Alert>
      );
    case "forbidden":
      return <Alert tone="error">{errorText(t, error)}</Alert>;
    default:
      return <QueryError error={error} />;
  }
}
