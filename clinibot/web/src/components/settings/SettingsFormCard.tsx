import { useId, type FormEvent, type ReactNode, type SyntheticEvent } from "react";
import { ErrorDetails } from "@/components/staff/ErrorDetails";
import { Button, Card, CardBody, CardFooter, CardHeader } from "@/components/ui";
import { useI18n } from "@/i18n";

interface SettingsFormCardProps {
  title: ReactNode;
  description?: ReactNode;
  /** Receptionists: every control disabled, no save buttons. */
  readOnly: boolean;
  dirty: boolean;
  saving: boolean;
  /** The last failed save, shown with its support reference. */
  error: unknown;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onDiscard: () => void;
  children: ReactNode;
}

/**
 * While a save runs the fields stay focusable (disabling them would drop
 * keyboard focus) but ignore edits: on success each section replaces the form
 * with what was stored, so an edit made during the save would be lost.
 */
function ignoreEdit(event: SyntheticEvent) {
  event.stopPropagation();
  if (event.type === "click") event.preventDefault();
}

/** A settings section: its own form, save button and unsaved-changes notice. */
export function SettingsFormCard({
  title,
  description,
  readOnly,
  dirty,
  saving,
  error,
  onSubmit,
  onDiscard,
  children,
}: SettingsFormCardProps) {
  const { t } = useI18n();
  const titleId = useId();
  return (
    <Card as="section" aria-labelledby={titleId}>
      <CardHeader title={<span id={titleId}>{title}</span>} description={description} />
      <form
        onSubmit={(event) => {
          // One save at a time; the fields stay enabled so focus is not dropped while it runs.
          if (saving) {
            event.preventDefault();
            return;
          }
          onSubmit(event);
        }}
        noValidate
      >
        <CardBody className="flex flex-col gap-4">
          {/* min-w-0: a fieldset is min-content wide by default and would overflow phones. */}
          <fieldset
            disabled={readOnly}
            aria-busy={saving || undefined}
            onChangeCapture={saving ? ignoreEdit : undefined}
            onClickCapture={saving ? ignoreEdit : undefined}
            className="flex min-w-0 flex-col gap-4"
          >
            {children}
          </fieldset>
          <div aria-live="polite" className="empty:hidden">
            {error !== null && error !== undefined && <ErrorDetails error={error} />}
          </div>
        </CardBody>
        {!readOnly && (
          <CardFooter>
            {dirty && (
              <p className="me-auto text-sm font-medium text-amber-800" role="status">
                {t("settings.unsaved")}
              </p>
            )}
            {dirty && (
              <Button variant="ghost" onClick={onDiscard} disabled={saving}>
                {t("settings.discard")}
              </Button>
            )}
            {/* aria-disabled, not disabled: after a save the focused button must keep focus. */}
            <Button type="submit" loading={saving} aria-disabled={!dirty || undefined}>
              {t("common.saveChanges")}
            </Button>
          </CardFooter>
        )}
      </form>
    </Card>
  );
}
