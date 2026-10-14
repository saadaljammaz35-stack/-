import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Alert, Field, Input, Textarea } from "@/components/ui";
import { useI18n, type MessageKey } from "@/i18n";
import { translate } from "@/i18n/translate";
import { useForm } from "@/lib/useForm";
import { parseDays, privacySchema, RETENTION } from "./model";
import { useUpdateClinicSettings, type ClinicSettings } from "./queries";
import { SettingsFormCard } from "./SettingsFormCard";

function initialValues(settings: ClinicSettings) {
  return {
    privacyAr: settings.privacy_notice_ar ?? "",
    privacyEn: settings.privacy_notice_en ?? "",
    messageDays: String(settings.message_retention_days),
    appointmentDays: String(settings.appointment_retention_days),
  };
}

/** clinic_settings: privacy notices and retention periods. */
export function PrivacySection({
  orgId,
  orgName,
  settings,
  readOnly,
}: {
  orgId: string;
  orgName: string;
  settings: ClinicSettings;
  readOnly: boolean;
}) {
  const [version, setVersion] = useState(0);
  return (
    <PrivacyForm
      key={version}
      orgId={orgId}
      orgName={orgName}
      settings={settings}
      readOnly={readOnly}
      onReset={() => setVersion((value) => value + 1)}
    />
  );
}

function PrivacyForm({
  orgId,
  orgName,
  settings,
  readOnly,
  onReset,
}: {
  orgId: string;
  orgName: string;
  settings: ClinicSettings;
  readOnly: boolean;
  onReset: () => void;
}) {
  const { t } = useI18n();
  const update = useUpdateClinicSettings(orgId);
  const [saved, setSaved] = useState(() => initialValues(settings));
  const form = useForm(privacySchema, saved);
  const dirty = JSON.stringify(form.values) !== JSON.stringify(saved);

  // The default notice the server sends when these are empty (supabase/functions/_shared/assistant/notices.ts).
  const days =
    parseDays(form.values.messageDays, RETENTION.messages.min, RETENTION.messages.max) ??
    settings.message_retention_days;
  const defaultAr = translate("ar", "settings.privacyDefault", {
    clinic: settings.display_name_ar?.trim() || orgName,
    days,
  });
  const defaultEn = translate("en", "settings.privacyDefault", {
    clinic: settings.display_name_en?.trim() || orgName,
    days,
  });

  const newAppointmentDays = parseDays(
    form.values.appointmentDays,
    RETENTION.appointments.min,
    RETENTION.appointments.max,
  );
  const lowered =
    days < Number(saved.messageDays) ||
    (newAppointmentDays !== null && newAppointmentDays < Number(saved.appointmentDays));

  const rangeError = (key: MessageKey | undefined, range: { min: number; max: number }) =>
    key && (key === "settings.retentionRange" ? t(key, range) : t(key));

  const submit = form.handleSubmit(async (patch) => {
    try {
      await update.mutateAsync(patch);
    } catch {
      return; // shown from update.error
    }
    const stored = {
      privacyAr: patch.privacy_notice_ar ?? "",
      privacyEn: patch.privacy_notice_en ?? "",
      messageDays: String(patch.message_retention_days),
      appointmentDays: String(patch.appointment_retention_days),
    };
    form.setFields(stored);
    setSaved(stored);
  });

  return (
    <SettingsFormCard
      title={t("settings.privacyTitle")}
      description={t("settings.privacyDescription")}
      readOnly={readOnly}
      dirty={dirty}
      saving={update.isPending}
      error={update.error}
      onSubmit={(event) => void submit(event)}
      onDiscard={onReset}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Field
          label={t("settings.privacyArLabel")}
          optional
          hint={t("settings.privacyHint")}
          error={form.errors.privacyAr && t(form.errors.privacyAr)}
        >
          <Textarea
            dir="rtl"
            lang="ar"
            rows={5}
            maxLength={1000}
            placeholder={defaultAr}
            value={form.values.privacyAr}
            onChange={(event) => form.setValue("privacyAr", event.target.value)}
          />
        </Field>
        <Field
          label={t("settings.privacyEnLabel")}
          optional
          hint={t("settings.privacyHint")}
          error={form.errors.privacyEn && t(form.errors.privacyEn)}
        >
          <Textarea
            dir="ltr"
            lang="en"
            rows={5}
            maxLength={1000}
            placeholder={defaultEn}
            value={form.values.privacyEn}
            onChange={(event) => form.setValue("privacyEn", event.target.value)}
          />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={t("settings.messageRetentionLabel")}
          hint={t("settings.messageRetentionHint")}
          required
          error={rangeError(form.errors.messageDays, RETENTION.messages)}
        >
          <Input
            inputMode="numeric"
            dir="ltr"
            maxLength={5}
            autoComplete="off"
            value={form.values.messageDays}
            onChange={(event) => form.setValue("messageDays", event.target.value)}
          />
        </Field>
        <Field
          label={t("settings.appointmentRetentionLabel")}
          hint={t("settings.appointmentRetentionHint")}
          required
          error={rangeError(form.errors.appointmentDays, RETENTION.appointments)}
        >
          <Input
            inputMode="numeric"
            dir="ltr"
            maxLength={5}
            autoComplete="off"
            value={form.values.appointmentDays}
            onChange={(event) => form.setValue("appointmentDays", event.target.value)}
          />
        </Field>
      </div>
      {lowered && !readOnly && <Alert tone="warning">{t("settings.retentionLowered")}</Alert>}
      <p className="flex items-start gap-2 rounded-xl bg-slate-50 px-4 py-3 text-[0.8125rem] leading-relaxed text-slate-700 ring-1 ring-slate-200 ring-inset">
        <Trash2 className="mt-0.5 size-4 shrink-0 text-slate-500" aria-hidden="true" />
        <span>{t("settings.retentionExplain")}</span>
      </p>
    </SettingsFormCard>
  );
}
