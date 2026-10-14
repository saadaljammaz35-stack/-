import { Alert } from "@/components/ui";
import { QueryError } from "@/components/layout/QueryError";
import { useI18n } from "@/i18n";
import { errorReference, errorText } from "@/lib/errors";
import { classifyConnectError, metaRejection } from "./model";

/**
 * Explains a failed whatsapp-connect call: Meta's own error code and message
 * when Meta rejected the request, or what the operator / owner must do.
 */
export function ConnectError({
  error,
  context,
}: {
  error: unknown;
  /** "save": nothing was stored. "test": the stored status is now "error". */
  context: "save" | "test" | "other";
}) {
  const { t, tRich } = useI18n();
  const reference = errorReference(error);
  const referenceLine = reference ? (
    <p className="mt-1 text-xs opacity-80">{t("errors.reference", { id: reference })}</p>
  ) : null;

  switch (classifyConnectError(error)) {
    case "meta_rejected": {
      const meta = metaRejection(error) ?? { code: null, message: null };
      return (
        <Alert tone="error" title={t("whatsapp.metaRejectedTitle")}>
          <p>
            {context === "save"
              ? t("whatsapp.metaRejectedSave")
              : context === "test"
                ? t("whatsapp.metaRejectedTest")
                : t("whatsapp.metaRejectedOther")}
          </p>
          {(meta.code !== null || meta.message) && (
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[0.8125rem]">
              {meta.code !== null && (
                <>
                  <dt className="font-bold">{t("whatsapp.metaCode")}</dt>
                  <dd dir="ltr" className="text-start font-mono">
                    {meta.code}
                  </dd>
                </>
              )}
              {meta.message && (
                <>
                  <dt className="font-bold">{t("whatsapp.metaMessage")}</dt>
                  <dd dir="ltr" lang="en" className="min-w-0 text-start break-words">
                    {meta.message}
                  </dd>
                </>
              )}
            </dl>
          )}
          {String(meta.code) === "190" && <p className="mt-2">{t("whatsapp.metaCode190")}</p>}
          {referenceLine}
        </Alert>
      );
    }
    case "phone_in_use":
      return (
        <Alert tone="error" title={t("whatsapp.phoneInUseTitle")}>
          {errorText(t, error)} {t("whatsapp.phoneInUseText")}
          {referenceLine}
        </Alert>
      );
    case "encryption_missing":
      return (
        <Alert tone="error" title={t("whatsapp.encryptionMissingTitle")}>
          {tRich("whatsapp.encryptionMissingText", {
            secret: (
              <code dir="ltr" className="font-mono font-bold">
                CREDENTIALS_ENCRYPTION_KEY
              </code>
            ),
            doc: (
              <code dir="ltr" className="font-mono">
                docs/DEPLOYMENT.md
              </code>
            ),
          })}
          {referenceLine}
        </Alert>
      );
    case "not_connected":
      return <Alert tone="warning">{errorText(t, error)}</Alert>;
    default:
      return <QueryError error={error} />;
  }
}
