import { useState } from "react";
import type { z } from "zod";
import { Field, Input, Select } from "@/components/ui";
import { useI18n } from "@/i18n";
import { SAUDI_CITIES } from "@/lib/saudiCities";
import { useForm } from "@/lib/useForm";
import { useOrg } from "@/org/useOrg";
import { OTHER_CITY, profileSchema } from "./model";
import { useUpdateOrganization } from "./queries";
import { SettingsFormCard } from "./SettingsFormCard";

export interface OrganizationProfile {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  phone: string | null;
  default_language: string;
}

function initialValues(profile: OrganizationProfile): z.input<typeof profileSchema> {
  const known = SAUDI_CITIES.some((city) => city.value === profile.city);
  return {
    name: profile.name,
    city: profile.city === null || profile.city === "" ? "" : known ? profile.city : OTHER_CITY,
    cityOther: profile.city !== null && !known ? profile.city : "",
    phone: profile.phone ?? "",
    language: profile.default_language === "en" ? "en" : "ar",
  };
}

/** organizations: name, city, phone, default_language (owners and admins edit). */
export function ProfileSection({
  profile,
  readOnly,
}: {
  profile: OrganizationProfile;
  readOnly: boolean;
}) {
  const [version, setVersion] = useState(0);
  return (
    <ProfileForm
      key={version}
      profile={profile}
      readOnly={readOnly}
      onReset={() => setVersion((value) => value + 1)}
    />
  );
}

function ProfileForm({
  profile,
  readOnly,
  onReset,
}: {
  profile: OrganizationProfile;
  readOnly: boolean;
  onReset: () => void;
}) {
  const { t } = useI18n();
  const { refresh } = useOrg();
  const update = useUpdateOrganization(profile.id);
  const [saved, setSaved] = useState(() => initialValues(profile));
  const form = useForm(profileSchema, saved);
  const dirty = JSON.stringify(form.values) !== JSON.stringify(saved);

  const submit = form.handleSubmit(async (patch) => {
    try {
      await update.mutateAsync(patch);
    } catch {
      return; // shown from update.error
    }
    // Show what was stored (e.g. the phone in +966 form) and treat it as the new baseline.
    const stored = { ...form.values, name: patch.name, phone: patch.phone ?? "" };
    form.setFields(stored);
    setSaved(stored);
    // The clinic name and language also appear in the clinic switcher.
    await refresh().catch(() => {});
  });

  return (
    <SettingsFormCard
      title={t("settings.profileTitle")}
      description={t("settings.profileDescription")}
      readOnly={readOnly}
      dirty={dirty}
      saving={update.isPending}
      error={update.error}
      onSubmit={(event) => void submit(event)}
      onDiscard={onReset}
    >
      <Field
        label={t("settings.nameLabel")}
        required
        error={form.errors.name && t(form.errors.name)}
      >
        <Input
          value={form.values.name}
          maxLength={120}
          autoComplete="organization"
          onChange={(event) => form.setValue("name", event.target.value)}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("settings.cityLabel")} optional>
          <Select
            value={form.values.city}
            onChange={(event) => form.setValue("city", event.target.value)}
          >
            <option value="">{t("settings.cityNone")}</option>
            {SAUDI_CITIES.map((city) => (
              <option key={city.value} value={city.value}>
                {t(city.label)}
              </option>
            ))}
            <option value={OTHER_CITY}>{t("settings.cityOther")}</option>
          </Select>
        </Field>
        {form.values.city === OTHER_CITY && (
          <Field
            label={t("settings.cityOtherLabel")}
            error={form.errors.cityOther && t(form.errors.cityOther)}
          >
            <Input
              value={form.values.cityOther}
              maxLength={80}
              onChange={(event) => form.setValue("cityOther", event.target.value)}
            />
          </Field>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={t("settings.phoneLabel")}
          optional
          hint={t("settings.phoneHint")}
          error={form.errors.phone && t(form.errors.phone)}
        >
          <Input
            type="tel"
            inputMode="tel"
            dir="ltr"
            autoComplete="tel"
            maxLength={20}
            value={form.values.phone}
            onChange={(event) => form.setValue("phone", event.target.value)}
          />
        </Field>
        <Field label={t("settings.languageLabel")} hint={t("settings.languageHint")}>
          <Select
            value={form.values.language}
            onChange={(event) =>
              form.setValue("language", event.target.value === "en" ? "en" : "ar")
            }
          >
            <option value="ar" lang="ar">
              {t("settings.languageAr")}
            </option>
            <option value="en" lang="en">
              {t("settings.languageEn")}
            </option>
          </Select>
        </Field>
      </div>
    </SettingsFormCard>
  );
}
