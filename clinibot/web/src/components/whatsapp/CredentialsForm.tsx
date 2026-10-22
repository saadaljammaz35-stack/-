import { useState, type FormEvent } from "react";
import { ShieldCheck } from "lucide-react";
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  Field,
  Input,
  SecretInput,
} from "@/components/ui";
import { useI18n } from "@/i18n";
import { isApiError } from "@/lib/apiError";
import type { FormErrors } from "@/components/knowledge/model";
import { useFieldErrorText } from "@/components/knowledge/useFieldErrorText";
import { ConnectError } from "./ConnectError";
import {
  EMPTY_CREDENTIALS,
  validateCredentials,
  type CredentialsField,
  type CredentialsValues,
} from "./model";
import { useSaveCredentials, type RevealedSecret } from "./queries";

const SERVER_FIELDS = new Set<string>(["phone_number_id", "waba_id", "access_token", "app_secret"]);

/**
 * Phone number ID, WABA ID, access token and app secret → whatsapp-connect
 * "save". Secrets are password fields, never prefilled, and cleared from
 * memory as soon as the request finishes.
 */
export function CredentialsForm({
  orgId,
  replacing,
  encryptionConfigured,
  onSaved,
  onCancel,
}: {
  orgId: string;
  /** True when a number is already stored: saving replaces it. */
  replacing: boolean;
  /** False when the server cannot encrypt credentials (CREDENTIALS_ENCRYPTION_KEY missing). */
  encryptionConfigured: boolean;
  onSaved: (secret: RevealedSecret) => void;
  onCancel?: () => void;
}) {
  const { t } = useI18n();
  const save = useSaveCredentials(orgId);
  const errorText = useFieldErrorText();
  const [values, setValues] = useState<CredentialsValues>(EMPTY_CREDENTIALS);
  const [errors, setErrors] = useState<FormErrors<CredentialsField>>({});
  const [submitted, setSubmitted] = useState(false);

  function set(key: CredentialsField, value: string) {
    const next = { ...values, [key]: value };
    setValues(next);
    if (submitted) {
      const result = validateCredentials(next);
      setErrors(result.ok ? {} : result.errors);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    const result = validateCredentials(values);
    if (!result.ok) {
      setErrors(result.errors);
      const form = event.currentTarget;
      requestAnimationFrame(() =>
        form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      );
      return;
    }
    setErrors({});
    save.mutate(result.payload, {
      onSuccess: (secret) => {
        setValues(EMPTY_CREDENTIALS);
        setSubmitted(false);
        onSaved(secret);
      },
      onError: (error) => {
        // Secrets never stay in the form after a failed attempt; ids are kept to fix typos.
        setValues((current) => ({ ...current, access_token: "", app_secret: "" }));
        if (isApiError(error)) {
          const fieldErrors: FormErrors<CredentialsField> = {};
          for (const issue of error.fieldIssues) {
            const field = issue.path.split(".")[0] ?? "";
            if (SERVER_FIELDS.has(field)) {
              fieldErrors[field as CredentialsField] = { key: "whatsapp.errServerField" };
            }
          }
          if (Object.keys(fieldErrors).length > 0) setErrors(fieldErrors);
        }
      },
    });
  }

  return (
    <Card as="section" aria-labelledby="wa-credentials-title">
      <CardHeader
        title={
          <span id="wa-credentials-title">
            {replacing ? t("whatsapp.replaceTitle") : t("whatsapp.credentialsTitle")}
          </span>
        }
        description={
          replacing ? t("whatsapp.replaceDescription") : t("whatsapp.credentialsDescription")
        }
      />
      <CardBody>
        <form onSubmit={submit} noValidate className="flex flex-col gap-5" autoComplete="off">
          {!encryptionConfigured && (
            <Alert tone="error" title={t("whatsapp.encryptionMissingTitle")}>
              {t("whatsapp.encryptionMissingShort")}
            </Alert>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label={t("whatsapp.phoneNumberId")}
              hint={t("whatsapp.phoneNumberIdHint")}
              error={errorText(errors.phone_number_id)}
              required
            >
              <Input
                dir="ltr"
                inputMode="numeric"
                autoComplete="off"
                spellCheck={false}
                value={values.phone_number_id}
                onChange={(event) => set("phone_number_id", event.target.value)}
              />
            </Field>
            <Field
              label={t("whatsapp.wabaId")}
              hint={t("whatsapp.wabaIdHint")}
              error={errorText(errors.waba_id)}
              required
            >
              <Input
                dir="ltr"
                inputMode="numeric"
                autoComplete="off"
                spellCheck={false}
                value={values.waba_id}
                onChange={(event) => set("waba_id", event.target.value)}
              />
            </Field>
          </div>

          <Field
            label={t("whatsapp.accessToken")}
            hint={t("whatsapp.accessTokenHint")}
            error={errorText(errors.access_token)}
            required
          >
            <SecretInput
              value={values.access_token}
              onChange={(event) => set("access_token", event.target.value)}
            />
          </Field>
          <Field
            label={t("whatsapp.appSecret")}
            hint={t("whatsapp.appSecretHint")}
            error={errorText(errors.app_secret)}
            required
          >
            <SecretInput
              value={values.app_secret}
              onChange={(event) => set("app_secret", event.target.value)}
            />
          </Field>

          <p className="flex items-start gap-2 text-[0.8125rem] leading-relaxed text-slate-600">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent-strong" aria-hidden="true" />
            {t("whatsapp.secretsNote")}
          </p>

          {save.error ? <ConnectError error={save.error} context="save" /> : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {onCancel && (
              <Button variant="outline" onClick={onCancel} disabled={save.isPending}>
                {t("common.cancel")}
              </Button>
            )}
            <Button type="submit" loading={save.isPending} disabled={!encryptionConfigured}>
              {save.isPending ? t("whatsapp.verifying") : t("whatsapp.saveAndVerify")}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
