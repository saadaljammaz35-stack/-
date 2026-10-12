import { useState } from "react";
import { ArrowLeft, Gift, LogOut } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { z } from "zod";
import { useAuth } from "@/auth/useAuth";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Alert, Button, Card, Field, Input, Select, useToast } from "@/components/ui";
import { useI18n, type Lang } from "@/i18n";
import { cn } from "@/lib/cn";
import { describeError, errorText } from "@/lib/errors";
import { OTHER_CITY, SAUDI_CITIES } from "@/lib/saudiCities";
import { supabase } from "@/lib/supabase";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import { useForm } from "@/lib/useForm";
import {
  isValidPhone,
  normalizePhone,
  sanitizeSlugInput,
  SLUG_MAX,
  SLUG_MIN,
  SLUG_PATTERN,
  slugify,
} from "@/lib/validation";
import { useOrg } from "@/org/useOrg";

const onboardingSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "onboarding.nameRequired")
      .min(2, "onboarding.nameTooShort")
      .max(120, "onboarding.nameTooLong"),
    slug: z
      .string()
      .trim()
      .min(1, "onboarding.slugRequired")
      .min(SLUG_MIN, "onboarding.slugTooShort")
      .max(SLUG_MAX, "onboarding.slugTooLong")
      .regex(SLUG_PATTERN, "onboarding.slugInvalid"),
    city: z.string().min(1, "onboarding.cityRequired"),
    cityOther: z.string().trim().max(80, "onboarding.cityTooLong"),
    phone: z
      .string()
      .transform((value) => normalizePhone(value))
      .refine((value) => value === "" || isValidPhone(value), "onboarding.phoneInvalid"),
    language: z.enum(["ar", "en"]),
  })
  .refine((value) => value.city !== OTHER_CITY || value.cityOther.length > 0, {
    message: "onboarding.cityOtherRequired",
    path: ["cityOther"],
  });

/** Create the first (or another) clinic, then continue to its dashboard. */
export default function OnboardingPage() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const toast = useToast();
  const { user, signOut } = useAuth();
  const { orgs, refresh, setCurrentOrg } = useOrg();
  const hasOrgs = orgs.length > 0;
  useDocumentTitle(t(hasOrgs ? "onboarding.addAnotherTitle" : "onboarding.title"));

  const form = useForm(onboardingSchema, {
    name: "",
    slug: "",
    city: "",
    cityOther: "",
    phone: "",
    language: lang,
  });
  const [slugEdited, setSlugEdited] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const origin = window.location.origin;
  const slugPreview = form.values.slug;

  function onNameChange(name: string) {
    // Suggest a link from a Latin-letter name until the user edits the link themselves.
    if (slugEdited) form.setValue("name", name);
    else form.setFields({ name, slug: slugify(name) });
  }

  const onSubmit = form.handleSubmit(async (data) => {
    setFormError(null);
    setSubmitting(true);
    try {
      const city = data.city === OTHER_CITY ? data.cityOther : data.city;
      const { data: orgId, error } = await supabase.rpc("create_organization", {
        p_name: data.name,
        p_slug: data.slug,
        p_city: city || undefined,
        p_phone: data.phone || undefined,
        p_language: data.language,
      });
      if (error) {
        if (describeError(error).code === "slug_taken") {
          form.setFieldError("slug", "errors.slug_taken");
          document.getElementById("onboarding-slug")?.focus();
        } else {
          setFormError(errorText(t, error));
        }
        return;
      }
      try {
        await refresh();
      } catch {
        // RequireOrg on /app shows a retry if memberships still fail to load.
      }
      setCurrentOrg(orgId);
      toast.success(t("onboarding.created", { name: data.name }));
      void navigate("/app", { replace: true });
    } catch (error) {
      setFormError(errorText(t, error));
    } finally {
      setSubmitting(false);
    }
  });

  const languageOptions: ReadonlyArray<{ value: Lang; label: string }> = [
    { value: "ar", label: t("onboarding.langArabic") },
    { value: "en", label: t("onboarding.langEnglish") },
  ];

  return (
    <AuthLayout aside={false}>
      <div className="flex flex-col gap-5">
        {hasOrgs && (
          <Link
            to="/app"
            className="inline-flex min-h-11 items-center gap-2 self-start text-sm font-bold text-primary hover:underline"
          >
            <ArrowLeft className="flip-rtl size-4" aria-hidden="true" />
            {t("onboarding.backToDashboard")}
          </Link>
        )}

        <Card className="p-6 sm:p-8">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            {t(hasOrgs ? "onboarding.addAnotherTitle" : "onboarding.title")}
          </h1>
          <p className="mt-2 leading-relaxed text-slate-600">{t("onboarding.subtitle")}</p>

          <form onSubmit={onSubmit} noValidate className="mt-7 flex flex-col gap-5">
            {formError && <Alert tone="error">{formError}</Alert>}

            <Field
              label={t("onboarding.clinicName")}
              hint={t("onboarding.clinicNameHint")}
              error={form.errors.name && t(form.errors.name)}
              required
            >
              <Input
                name="organization"
                autoComplete="organization"
                placeholder={t("onboarding.clinicNamePlaceholder")}
                value={form.values.name}
                onChange={(event) => onNameChange(event.target.value)}
                maxLength={120}
              />
            </Field>

            <Field
              id="onboarding-slug"
              label={t("onboarding.slug")}
              hint={t("onboarding.slugHint")}
              error={form.errors.slug && t(form.errors.slug)}
              required
            >
              <Input
                name="slug"
                dir="ltr"
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                inputMode="url"
                placeholder={t("onboarding.slugPlaceholder")}
                value={form.values.slug}
                maxLength={SLUG_MAX}
                onChange={(event) => {
                  setSlugEdited(true);
                  form.setValue("slug", sanitizeSlugInput(event.target.value));
                }}
              />
            </Field>

            <div className="-mt-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3.5 py-3">
              <p className="text-xs font-bold text-slate-500">{t("onboarding.slugPreviewLabel")}</p>
              {slugPreview ? (
                <p dir="ltr" className="mt-1 text-start font-mono text-sm break-all text-slate-800" aria-live="polite">
                  {origin}/c/<span className="font-bold text-primary">{slugPreview}</span>
                </p>
              ) : (
                <p className="mt-1 text-sm text-slate-500">{t("onboarding.slugPreviewEmpty")}</p>
              )}
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label={t("onboarding.city")} error={form.errors.city && t(form.errors.city)} required>
                <Select
                  name="city"
                  placeholder={t("onboarding.cityPlaceholder")}
                  value={form.values.city}
                  onChange={(event) => form.setValue("city", event.target.value)}
                >
                  {SAUDI_CITIES.map((city) => (
                    <option key={city.value} value={city.value}>
                      {t(city.label)}
                    </option>
                  ))}
                  <option value={OTHER_CITY}>{t("onboarding.cityOther")}</option>
                </Select>
              </Field>

              <Field
                label={t("onboarding.phone")}
                hint={t("onboarding.phoneHint")}
                error={form.errors.phone && t(form.errors.phone)}
                optional
              >
                <Input
                  type="tel"
                  name="tel"
                  dir="ltr"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="05XXXXXXXX"
                  value={form.values.phone}
                  onChange={(event) => form.setValue("phone", event.target.value)}
                  maxLength={20}
                />
              </Field>
            </div>

            {form.values.city === OTHER_CITY && (
              <Field
                label={t("onboarding.cityOtherLabel")}
                error={form.errors.cityOther && t(form.errors.cityOther)}
                required
              >
                <Input
                  name="address-level2"
                  autoComplete="address-level2"
                  value={form.values.cityOther}
                  onChange={(event) => form.setValue("cityOther", event.target.value)}
                  maxLength={80}
                />
              </Field>
            )}

            <fieldset>
              <legend className="text-sm font-bold text-slate-800">{t("onboarding.language")}</legend>
              <p id="onboarding-language-hint" className="mt-1 text-[0.8125rem] leading-relaxed text-slate-600">
                {t("onboarding.languageHint")}
              </p>
              <div className="mt-2.5 grid grid-cols-2 gap-3">
                {languageOptions.map((option) => {
                  const selected = form.values.language === option.value;
                  return (
                    <label
                      key={option.value}
                      className={cn(
                        "flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3.5 text-sm font-bold transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary",
                        selected
                          ? "border-primary bg-primary-soft text-primary"
                          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
                      )}
                    >
                      <input
                        type="radio"
                        name="language"
                        value={option.value}
                        checked={selected}
                        onChange={() => form.setValue("language", option.value)}
                        aria-describedby="onboarding-language-hint"
                        className="size-4 accent-primary"
                      />
                      <span lang={option.value}>{option.label}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div className="rounded-2xl border border-emerald-200 bg-mint p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-accent-strong">
                  <Gift className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h2 className="font-extrabold text-emerald-950">{t("onboarding.trialTitle")}</h2>
                  <p className="mt-1 text-sm leading-relaxed text-emerald-900">{t("onboarding.trialText")}</p>
                  <ul className="mt-3 flex list-disc flex-col gap-1.5 ps-5 text-sm leading-relaxed text-emerald-900 marker:text-accent-strong">
                    <li>{t("onboarding.trialPoint1")}</li>
                    <li>{t("onboarding.trialPoint2")}</li>
                    <li>{t("onboarding.trialPoint3")}</li>
                  </ul>
                </div>
              </div>
            </div>

            <Button type="submit" size="lg" fullWidth loading={submitting}>
              {submitting ? t("onboarding.submitting") : t("onboarding.submit")}
            </Button>
          </form>
        </Card>

        {user && (
          <div className="flex flex-wrap items-center justify-center gap-x-2 text-sm text-slate-600">
            <span>{t("common.signedInAs")}</span>
            <bdi dir="ltr" className="font-bold text-slate-800">
              {user.email}
            </bdi>
            <Button
              variant="ghost"
              size="sm"
              icon={<LogOut className="flip-rtl size-4" aria-hidden="true" />}
              onClick={() => void signOut().then(() => navigate("/login", { replace: true }))}
            >
              {t("common.signOut")}
            </Button>
          </div>
        )}
      </div>
    </AuthLayout>
  );
}
