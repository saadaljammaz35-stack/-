import { useState } from "react";
import { Field, Input, Textarea } from "@/components/ui";
import { useI18n } from "@/i18n";
import { useForm } from "@/lib/useForm";
import { detailsSchema } from "./model";
import { useUpdateClinicSettings, type ClinicSettings } from "./queries";
import { SettingsFormCard } from "./SettingsFormCard";

function initialValues(settings: ClinicSettings) {
  return {
    displayNameAr: settings.display_name_ar ?? "",
    displayNameEn: settings.display_name_en ?? "",
    addressAr: settings.address_ar ?? "",
    addressEn: settings.address_en ?? "",
    mapsUrl: settings.maps_url ?? "",
    receptionPhone: settings.reception_phone ?? "",
  };
}

/** clinic_settings: names, address, map link and reception phone. */
export function DetailsSection({
  orgId,
  settings,
  readOnly,
}: {
  orgId: string;
  settings: ClinicSettings;
  readOnly: boolean;
}) {
  const [version, setVersion] = useState(0);
  return (
    <DetailsForm
      key={version}
      orgId={orgId}
      settings={settings}
      readOnly={readOnly}
      onReset={() => setVersion((value) => value + 1)}
    />
  );
}

function DetailsForm({
  orgId,
  settings,
  readOnly,
  onReset,
}: {
  orgId: string;
  settings: ClinicSettings;
  readOnly: boolean;
  onReset: () => void;
}) {
  const { t } = useI18n();
  const update = useUpdateClinicSettings(orgId);
  const [saved, setSaved] = useState(() => initialValues(settings));
  const form = useForm(detailsSchema, saved);
  const dirty = JSON.stringify(form.values) !== JSON.stringify(saved);
  const errorOf = (field: keyof typeof saved) => {
    const key = form.errors[field];
    return key && t(key);
  };

  const submit = form.handleSubmit(async (patch) => {
    try {
      await update.mutateAsync(patch);
    } catch {
      return; // shown from update.error
    }
    const stored = {
      displayNameAr: patch.display_name_ar ?? "",
      displayNameEn: patch.display_name_en ?? "",
      addressAr: patch.address_ar ?? "",
      addressEn: patch.address_en ?? "",
      mapsUrl: patch.maps_url ?? "",
      receptionPhone: patch.reception_phone ?? "",
    };
    form.setFields(stored);
    setSaved(stored);
  });

  return (
    <SettingsFormCard
      title={t("settings.detailsTitle")}
      description={t("settings.detailsDescription")}
      readOnly={readOnly}
      dirty={dirty}
      saving={update.isPending}
      error={update.error}
      onSubmit={(event) => void submit(event)}
      onDiscard={onReset}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("settings.displayNameArLabel")} optional error={errorOf("displayNameAr")}>
          <Input
            dir="rtl"
            lang="ar"
            maxLength={120}
            value={form.values.displayNameAr}
            onChange={(event) => form.setValue("displayNameAr", event.target.value)}
          />
        </Field>
        <Field label={t("settings.displayNameEnLabel")} optional error={errorOf("displayNameEn")}>
          <Input
            dir="ltr"
            lang="en"
            maxLength={120}
            value={form.values.displayNameEn}
            onChange={(event) => form.setValue("displayNameEn", event.target.value)}
          />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("settings.addressArLabel")} optional error={errorOf("addressAr")}>
          <Textarea
            dir="rtl"
            lang="ar"
            rows={2}
            maxLength={300}
            placeholder={t("settings.addressPlaceholderAr")}
            value={form.values.addressAr}
            onChange={(event) => form.setValue("addressAr", event.target.value)}
          />
        </Field>
        <Field label={t("settings.addressEnLabel")} optional error={errorOf("addressEn")}>
          <Textarea
            dir="ltr"
            lang="en"
            rows={2}
            maxLength={300}
            placeholder={t("settings.addressPlaceholderEn")}
            value={form.values.addressEn}
            onChange={(event) => form.setValue("addressEn", event.target.value)}
          />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={t("settings.mapsUrlLabel")}
          optional
          hint={t("settings.mapsUrlHint")}
          error={errorOf("mapsUrl")}
        >
          <Input
            type="url"
            inputMode="url"
            dir="ltr"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={500}
            placeholder="https://maps.app.goo.gl/…"
            value={form.values.mapsUrl}
            onChange={(event) => form.setValue("mapsUrl", event.target.value)}
          />
        </Field>
        <Field
          label={t("settings.receptionPhoneLabel")}
          optional
          hint={t("settings.receptionPhoneHint")}
          error={errorOf("receptionPhone")}
        >
          <Input
            type="tel"
            inputMode="tel"
            dir="ltr"
            autoComplete="off"
            maxLength={20}
            value={form.values.receptionPhone}
            onChange={(event) => form.setValue("receptionPhone", event.target.value)}
          />
        </Field>
      </div>
    </SettingsFormCard>
  );
}
