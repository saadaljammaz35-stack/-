import { Alert } from "@/components/ui";
import { useI18n } from "@/i18n";
import { errorReference, errorText } from "@/lib/errors";

/** Inline error for a failed action: the translated message and the support reference, if any. */
export function ErrorDetails({ error, className }: { error: unknown; className?: string }) {
  const { t, tRich } = useI18n();
  const reference = errorReference(error);
  return (
    <Alert tone="error" className={className}>
      <p>{errorText(t, error)}</p>
      {reference && (
        <p className="mt-1 text-xs opacity-80">
          {tRich("errors.reference", {
            id: (
              <span dir="ltr" className="font-mono select-all">
                {reference}
              </span>
            ),
          })}
        </p>
      )}
    </Alert>
  );
}

/**
 * The same, as inline content for places that already provide the alert box
 * (e.g. ConfirmDialog's `error`, which renders inside a <p role="alert">).
 */
export function ErrorInline({ error }: { error: unknown }) {
  const { t, tRich } = useI18n();
  const reference = errorReference(error);
  return (
    <>
      <span>{errorText(t, error)}</span>
      {reference && (
        <span className="mt-1 block text-xs font-normal opacity-80">
          {tRich("errors.reference", {
            id: (
              <span dir="ltr" className="font-mono select-all">
                {reference}
              </span>
            ),
          })}
        </span>
      )}
    </>
  );
}
