import { useState, type FormEvent } from "react";
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  Field,
  Input,
  Select,
  SkeletonText,
} from "@/components/ui";
import { QueryError } from "@/components/layout/QueryError";
import { useI18n, type MessageKey } from "@/i18n";
import type { FormErrors } from "@/components/knowledge/model";
import { useFieldErrorText } from "@/components/knowledge/useFieldErrorText";
import { TEMPLATE_LANGUAGES, validateTemplate, type TemplateValues } from "./model";
import { useIntegration, useSaveTemplate, type IntegrationRow } from "./queries";

const LANGUAGE_LABELS: Record<string, MessageKey> = {
  ar: "whatsapp.langAr",
  en: "whatsapp.langEn",
  en_US: "whatsapp.langEnUs",
  en_GB: "whatsapp.langEnGb",
};

/** The Meta-approved Utility template used to confirm appointments outside the 24-hour window. */
export function TemplateCard({ orgId }: { orgId: string }) {
  const { t } = useI18n();
  const integration = useIntegration(orgId, true);

  return (
    <Card as="section" aria-labelledby="wa-template-title">
      <CardHeader
        title={<span id="wa-template-title">{t("whatsapp.templateTitle")}</span>}
        description={t("whatsapp.templateDescription")}
      />
      <CardBody className="flex flex-col gap-5">
        <div className="flex flex-col gap-3 text-sm leading-relaxed text-slate-700">
          <div className="rounded-xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200">
            <p className="font-bold text-slate-900">{t("whatsapp.windowTitle")}</p>
            <p className="mt-1">{t("whatsapp.windowText")}</p>
          </div>
          <p>{t("whatsapp.templateRules")}</p>
          <ul className="list-disc ps-5">
            <li>
              <code dir="ltr" className="font-mono font-bold">{"{{1}}"}</code> {t("whatsapp.templateVar1")}
            </li>
            <li>
              <code dir="ltr" className="font-mono font-bold">{"{{2}}"}</code> {t("whatsapp.templateVar2")}
            </li>
            <li>
              <code dir="ltr" className="font-mono font-bold">{"{{3}}"}</code> {t("whatsapp.templateVar3")}
            </li>
          </ul>
          <figure className="rounded-xl border-s-4 border-accent bg-mint/50 px-4 py-3">
            <figcaption className="text-[0.8125rem] font-bold text-slate-600">
              {t("whatsapp.templateExampleLabel")}
            </figcaption>
            <blockquote lang="ar" dir="rtl" className="mt-1 text-slate-900">
              {t("whatsapp.templateExample")}
            </blockquote>
          </figure>
        </div>

        {integration.isPending ? (
          <SkeletonText lines={3} />
        ) : integration.error ? (
          <QueryError error={integration.error} onRetry={() => void integration.refetch()} />
        ) : !integration.data ? (
          <Alert tone="info">{t("whatsapp.templateNeedsConnection")}</Alert>
        ) : (
          <TemplateForm
            key={`${integration.data.confirmationTemplateName ?? ""}|${integration.data.confirmationTemplateLanguage}`}
            orgId={orgId}
            row={integration.data}
          />
        )}
      </CardBody>
    </Card>
  );
}

function TemplateForm({ orgId, row }: { orgId: string; row: IntegrationRow }) {
  const { t } = useI18n();
  const save = useSaveTemplate(orgId);
  const errorText = useFieldErrorText();
  const initial: TemplateValues = {
    name: row.confirmationTemplateName ?? "",
    language: row.confirmationTemplateLanguage,
  };
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<FormErrors<keyof TemplateValues>>({});
  const dirty = values.name !== initial.name || values.language !== initial.language;
  const languages: string[] = [...TEMPLATE_LANGUAGES];
  if (!languages.includes(initial.language)) languages.push(initial.language);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = validateTemplate(values);
    if (!result.ok) {
      setErrors(result.errors);
      const form = event.currentTarget;
      requestAnimationFrame(() =>
        form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      );
      return;
    }
    setErrors({});
    save.mutate({ id: row.id, payload: result.payload });
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5 border-t border-slate-100 pt-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label={t("whatsapp.templateName")}
          hint={t("whatsapp.templateNameHint")}
          error={errorText(errors.name)}
          optional
        >
          <Input
            dir="ltr"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="appointment_confirmation"
            value={values.name}
            onChange={(event) => {
              setValues({ ...values, name: event.target.value });
              if (errors.name) setErrors({ ...errors, name: undefined });
            }}
          />
        </Field>
        <Field label={t("whatsapp.templateLanguage")} error={errorText(errors.language)} required>
          <Select
            value={values.language}
            onChange={(event) => setValues({ ...values, language: event.target.value })}
          >
            {languages.map((code) => (
              <option key={code} value={code}>
                {LANGUAGE_LABELS[code] ? `${t(LANGUAGE_LABELS[code])} (${code})` : code}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {!values.name.trim() && (
        <p className="text-[0.8125rem] leading-relaxed text-slate-600">{t("whatsapp.templateEmptyNote")}</p>
      )}
      {save.error ? <QueryError error={save.error} /> : null}
      <div className="flex justify-end">
        <Button type="submit" loading={save.isPending} disabled={!dirty}>
          {t("common.saveChanges")}
        </Button>
      </div>
    </form>
  );
}
