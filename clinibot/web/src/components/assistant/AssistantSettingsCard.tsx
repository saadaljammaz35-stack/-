import { useState, type FormEvent } from "react";
import { ShieldCheck } from "lucide-react";
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Field,
  Input,
  Select,
  SkeletonText,
  Textarea,
} from "@/components/ui";
import { QueryError } from "@/components/layout/QueryError";
import { useI18n } from "@/i18n";
import type { FormErrors } from "@/components/knowledge/model";
import { useFieldErrorText } from "@/components/knowledge/useFieldErrorText";
import {
  SETTINGS_LIMITS,
  TONES,
  validateAssistantSettings,
  type AssistantSettingsValues,
  type SettingsField,
} from "./model";
import { useAssistantSettings, useSaveAssistantSettings, type AssistantSettings } from "./queries";

function toValues(settings: AssistantSettings): AssistantSettingsValues {
  return {
    assistant_name: settings.assistantName,
    assistant_tone: settings.assistantTone,
    welcome_message_ar: settings.welcomeMessageAr ?? "",
    welcome_message_en: settings.welcomeMessageEn ?? "",
    extra_instructions: settings.extraInstructions ?? "",
    emergency_number: settings.emergencyNumber,
  };
}

/** How the assistant introduces itself and behaves (clinic_settings). */
export function AssistantSettingsCard({ orgId, canEdit }: { orgId: string; canEdit: boolean }) {
  const { t } = useI18n();
  const settings = useAssistantSettings(orgId);

  return (
    <Card as="section" aria-labelledby="assistant-settings-title">
      <CardHeader
        title={<span id="assistant-settings-title">{t("assistant.settingsTitle")}</span>}
        description={t("assistant.settingsDescription")}
      />
      {settings.isPending ? (
        <CardBody>
          <SkeletonText lines={6} />
        </CardBody>
      ) : settings.error ? (
        <CardBody>
          <QueryError error={settings.error} onRetry={() => void settings.refetch()} />
        </CardBody>
      ) : !settings.data ? (
        <CardBody>
          <Alert tone="error">{t("assistant.settingsMissing")}</Alert>
        </CardBody>
      ) : (
        // Remount only when the saved values change (after a save, or an edit by someone else),
        // never on a background refetch, so typing is not lost.
        <SettingsForm
          key={JSON.stringify(toValues(settings.data))}
          orgId={orgId}
          canEdit={canEdit}
          initial={toValues(settings.data)}
        />
      )}
    </Card>
  );
}

function SettingsForm({
  orgId,
  canEdit,
  initial,
}: {
  orgId: string;
  canEdit: boolean;
  initial: AssistantSettingsValues;
}) {
  const { t, formatNumber } = useI18n();
  const save = useSaveAssistantSettings(orgId);
  const errorText = useFieldErrorText();
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<FormErrors<SettingsField>>({});
  const [submitted, setSubmitted] = useState(false);
  const dirty = JSON.stringify(values) !== JSON.stringify(initial);

  function set<K extends SettingsField>(key: K, value: AssistantSettingsValues[K]) {
    const next = { ...values, [key]: value };
    setValues(next);
    if (submitted) {
      const result = validateAssistantSettings(next);
      setErrors(result.ok ? {} : result.errors);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit) return;
    setSubmitted(true);
    const result = validateAssistantSettings(values);
    if (!result.ok) {
      setErrors(result.errors);
      const form = event.currentTarget;
      requestAnimationFrame(() =>
        form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      );
      return;
    }
    setErrors({});
    save.mutate(result.payload);
  }

  const count = (value: string, max: number) =>
    t("assistant.charCount", { count: formatNumber(value.trim().length), max: formatNumber(max) });

  return (
    <form onSubmit={submit} noValidate>
      <fieldset disabled={!canEdit} className="min-w-0">
        <legend className="sr-only">{t("assistant.settingsTitle")}</legend>
        <CardBody className="flex flex-col gap-5">
          {!canEdit && <Alert tone="info">{t("assistant.settingsReadOnly")}</Alert>}

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label={t("assistant.fieldName")}
              hint={t("assistant.fieldNameHint", { max: formatNumber(SETTINGS_LIMITS.nameMax) })}
              error={errorText(errors.assistant_name)}
              required
            >
              <Input
                dir="auto"
                value={values.assistant_name}
                onChange={(event) => set("assistant_name", event.target.value)}
                autoComplete="off"
              />
            </Field>
            <Field label={t("assistant.fieldTone")} error={errorText(errors.assistant_tone)} required>
              <Select
                value={values.assistant_tone}
                onChange={(event) => {
                  const tone = TONES.find((value) => value === event.target.value);
                  if (tone) set("assistant_tone", tone);
                }}
              >
                <option value="friendly">{t("assistant.toneFriendly")}</option>
                <option value="formal">{t("assistant.toneFormal")}</option>
              </Select>
            </Field>
          </div>

          <Field
            label={t("assistant.fieldWelcomeAr")}
            hint={count(values.welcome_message_ar, SETTINGS_LIMITS.welcomeMax)}
            error={errorText(errors.welcome_message_ar)}
            optional
          >
            <Textarea
              dir="rtl"
              lang="ar"
              rows={3}
              value={values.welcome_message_ar}
              onChange={(event) => set("welcome_message_ar", event.target.value)}
            />
          </Field>
          <Field
            label={t("assistant.fieldWelcomeEn")}
            hint={count(values.welcome_message_en, SETTINGS_LIMITS.welcomeMax)}
            error={errorText(errors.welcome_message_en)}
            optional
          >
            <Textarea
              dir="ltr"
              lang="en"
              rows={3}
              value={values.welcome_message_en}
              onChange={(event) => set("welcome_message_en", event.target.value)}
            />
          </Field>

          <div className="flex flex-col gap-3">
            <Field
              label={t("assistant.fieldInstructions")}
              hint={`${t("assistant.fieldInstructionsHint")} ${count(values.extra_instructions, SETTINGS_LIMITS.instructionsMax)}`}
              error={errorText(errors.extra_instructions)}
              optional
            >
              <Textarea
                dir="auto"
                rows={5}
                value={values.extra_instructions}
                onChange={(event) => set("extra_instructions", event.target.value)}
              />
            </Field>
            <div className="flex items-start gap-3 rounded-xl bg-primary-soft px-4 py-3 text-[0.8125rem] leading-relaxed text-navy-900">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
              <div>
                <p className="font-bold">{t("assistant.safetyTitle")}</p>
                <ul className="mt-1 list-disc ps-5">
                  <li>{t("assistant.safetyNoDiagnosis")}</li>
                  <li>{t("assistant.safetyNoPrices")}</li>
                  <li>{t("assistant.safetyRequestsOnly")}</li>
                  <li>{t("assistant.safetyEmergency")}</li>
                </ul>
              </div>
            </div>
          </div>

          <Field
            label={t("assistant.fieldEmergency")}
            hint={t("assistant.fieldEmergencyHint")}
            error={errorText(errors.emergency_number)}
            required
            className="sm:max-w-xs"
          >
            <Input
              dir="ltr"
              inputMode="numeric"
              autoComplete="off"
              value={values.emergency_number}
              onChange={(event) => set("emergency_number", event.target.value)}
            />
          </Field>

          {save.error ? <QueryError error={save.error} /> : null}
        </CardBody>
        {canEdit && (
          <CardFooter>
            {dirty && !save.isPending && (
              <p className="me-auto text-[0.8125rem] text-slate-600" aria-live="polite">
                {t("assistant.unsavedChanges")}
              </p>
            )}
            <Button
              variant="outline"
              onClick={() => {
                setValues(initial);
                setErrors({});
                setSubmitted(false);
                save.reset();
              }}
              disabled={!dirty || save.isPending}
            >
              {t("assistant.discardChanges")}
            </Button>
            <Button type="submit" loading={save.isPending} disabled={!dirty}>
              {t("common.saveChanges")}
            </Button>
          </CardFooter>
        )}
      </fieldset>
    </form>
  );
}
