import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { CircleCheck, Mail, Send } from "lucide-react";
import { Link } from "react-router";
import { Alert, Checkbox, Field, Input, Select, Spinner, Textarea } from "@/components/ui";
import { useI18n, type MessageKey } from "@/i18n";
import { cn } from "@/lib/cn";
import { errorReference, errorText } from "@/lib/errors";
import { useForm } from "@/lib/useForm";
import {
  CLINIC_TYPE_LABELS,
  CLINIC_TYPES,
  contactEmail,
  demoErrorView,
  demoRequestPayload,
  demoRequestSchema,
  EMPTY_DEMO_REQUEST,
  isDemoRequestCreated,
  type DemoField,
} from "./demoRequest";
import { Section, SectionHeading } from "./Section";
import { container, inlineLink, mkButton } from "./styles";

const FORM_ID = "demo-request-form";

const STEPS: readonly MessageKey[] = [
  "marketing.contactStep1",
  "marketing.contactStep2",
  "marketing.contactStep3",
];

export function DemoRequest() {
  const { t, tRich, formatNumber } = useI18n();
  const [sent, setSent] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const email = contactEmail();

  return (
    <Section id="contact" labelledBy="contact-title" className="py-16 sm:py-24">
      <div
        className={cn(
          container,
          "grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14",
        )}
      >
        <div className="flex flex-col gap-8">
          <SectionHeading
            id="contact-title"
            kicker={t("marketing.contactKicker")}
            title={t("marketing.contactTitle")}
            intro={t("marketing.contactIntro")}
          />

          <div>
            <h3 className="font-bold text-slate-900">{t("marketing.contactStepsTitle")}</h3>
            <ol className="mt-4 flex flex-col gap-4">
              {STEPS.map((step, index) => (
                <li key={step} className="flex items-start gap-3">
                  <span className="relative isolate flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold text-primary ring-1 ring-slate-200">
                    {index === 0 && (
                      <span
                        className="mk-live mk-live--breathe absolute -inset-1 -z-10 rounded-full bg-mint"
                        aria-hidden="true"
                      />
                    )}
                    {formatNumber(index + 1)}
                  </span>
                  <span className="max-w-[44ch] pt-1 leading-relaxed text-slate-700">
                    {t(step)}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          {email && (
            <p className="flex items-center gap-2.5 text-slate-700">
              <Mail className="size-5 shrink-0 text-primary" aria-hidden="true" />
              <span>
                {tRich("marketing.contactEmail", {
                  email: (
                    <a href={`mailto:${email}`} className={inlineLink} dir="ltr">
                      {email}
                    </a>
                  ),
                })}
              </span>
            </p>
          )}
        </div>

        <div className="rounded-3xl bg-white p-5 shadow-card ring-1 ring-slate-200 sm:p-8">
          {sent ? (
            <DemoSuccess
              onAnother={() => {
                setFormKey((key) => key + 1);
                setSent(false);
              }}
            />
          ) : (
            <DemoForm key={formKey} onSent={() => setSent(true)} />
          )}
        </div>
      </div>
    </Section>
  );
}

interface Failure {
  text: string;
  requestId: string | null;
}

function DemoForm({ onSent }: { onSent: () => void }) {
  const { t, tRich, lang } = useI18n();
  const form = useForm(demoRequestSchema, EMPTY_DEMO_REQUEST);
  const [website, setWebsite] = useState("");
  const [failure, setFailure] = useState<Failure | null>(null);

  const mutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      // Loaded on demand: the landing page paints without the Supabase client.
      const { callFunction } = await import("@/lib/api");
      return callFunction<unknown>("demo-request", payload);
    },
    meta: { silentError: true },
  });

  const onSubmit = form.handleSubmit(async (data) => {
    setFailure(null);
    try {
      const body = await mutation.mutateAsync(demoRequestPayload(data, lang, website));
      // Success is shown only for the server's { ok: true, id } (sent with 201
      // after the request is stored); anything else is treated as a failure.
      if (!isDemoRequestCreated(body)) {
        setFailure({ text: t("errors.unknown"), requestId: null });
        return;
      }
      onSent();
    } catch (error) {
      const view = demoErrorView(error);
      if (view.kind === "fields") {
        for (const [field, message] of Object.entries(view.fields)) {
          form.setFieldError(field as DemoField, message);
        }
        setFailure({ text: t("marketing.errFormFields"), requestId: null });
        requestAnimationFrame(() => {
          document
            .getElementById(FORM_ID)
            ?.querySelector<HTMLElement>('[aria-invalid="true"]')
            ?.focus();
        });
      } else if (view.kind === "rate_limited") {
        setFailure({ text: t("marketing.errRateLimited"), requestId: null });
      } else if (view.kind === "network") {
        setFailure({ text: t("marketing.errNetwork"), requestId: null });
      } else {
        setFailure({ text: errorText(t, error), requestId: errorReference(error) });
      }
    }
  });

  const error = (field: DemoField) => {
    const key = form.errors[field];
    return key ? t(key) : undefined;
  };
  const sending = mutation.isPending;

  const privacyLink = (
    <Link to="/privacy" target="_blank" rel="noopener" className={inlineLink}>
      {t("marketing.consentPrivacyLink")}
      <span className="sr-only"> {t("common.opensInNewTab")}</span>
    </Link>
  );

  return (
    <form
      id={FORM_ID}
      onSubmit={onSubmit}
      noValidate
      aria-labelledby="demo-form-title"
      className="flex flex-col gap-5"
    >
      <div>
        <h3 id="demo-form-title" className="text-lg font-bold text-slate-900">
          {t("marketing.formTitle")}
        </h3>
        <p className="mt-1 text-sm text-slate-600">{t("marketing.formRequiredNote")}</p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t("marketing.fieldClinicName")} error={error("clinic_name")} required>
          <Input
            name="clinic_name"
            autoComplete="organization"
            value={form.values.clinic_name}
            onChange={(event) => form.setValue("clinic_name", event.target.value)}
          />
        </Field>
        <Field label={t("marketing.fieldContactName")} error={error("contact_name")} required>
          <Input
            name="contact_name"
            autoComplete="name"
            value={form.values.contact_name}
            onChange={(event) => form.setValue("contact_name", event.target.value)}
          />
        </Field>
        <Field
          label={t("marketing.fieldPhone")}
          hint={t("marketing.fieldPhoneHint")}
          error={error("phone")}
          required
        >
          <Input
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            dir="ltr"
            className={lang === "ar" ? "text-end" : undefined}
            value={form.values.phone}
            onChange={(event) => form.setValue("phone", event.target.value)}
          />
        </Field>
        <Field label={t("marketing.fieldEmail")} error={error("email")} optional>
          <Input
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            dir="ltr"
            className={lang === "ar" ? "text-end" : undefined}
            value={form.values.email}
            onChange={(event) => form.setValue("email", event.target.value)}
          />
        </Field>
        <Field label={t("marketing.fieldCity")} error={error("city")} optional>
          <Input
            name="city"
            autoComplete="address-level2"
            value={form.values.city}
            onChange={(event) => form.setValue("city", event.target.value)}
          />
        </Field>
        <Field label={t("marketing.fieldClinicType")} error={error("clinic_type")} optional>
          <Select
            name="clinic_type"
            value={form.values.clinic_type}
            placeholder={t("marketing.fieldClinicTypePlaceholder")}
            onChange={(event) =>
              form.setValue("clinic_type", event.target.value as (typeof CLINIC_TYPES)[number] | "")
            }
          >
            {CLINIC_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(CLINIC_TYPE_LABELS[type])}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field
        label={t("marketing.fieldMessage")}
        hint={t("marketing.fieldMessageHint")}
        error={error("message")}
        optional
      >
        <Textarea
          name="message"
          rows={4}
          value={form.values.message}
          onChange={(event) => form.setValue("message", event.target.value)}
        />
      </Field>

      {/* Honeypot: hidden from people and assistive technology; only bots fill it. */}
      <div className="sr-only" aria-hidden="true">
        <label htmlFor="demo-website">{t("marketing.honeypotLabel")}</label>
        <input
          id="demo-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
        />
      </div>

      <Checkbox
        name="consent"
        checked={form.values.consent}
        onChange={(event) => form.setValue("consent", event.target.checked)}
        label={tRich("marketing.consentLabel", { privacy: privacyLink })}
        error={error("consent")}
        required
      />

      <div aria-live="polite">
        {failure && (
          <Alert tone="error">
            <p>{failure.text}</p>
            {failure.requestId && (
              <p className="mt-1 text-xs opacity-80">
                {tRich("errors.reference", {
                  id: (
                    <span dir="ltr" className="font-mono select-all">
                      {failure.requestId}
                    </span>
                  ),
                })}
              </p>
            )}
          </Alert>
        )}
      </div>

      <button
        type="submit"
        disabled={sending}
        aria-busy={sending || undefined}
        className={mkButton("cta", "lg", "w-full sm:w-auto sm:self-start")}
      >
        {sending ? <Spinner size="sm" /> : <Send className="flip-rtl size-5" aria-hidden="true" />}
        {sending ? t("marketing.submitting") : t("marketing.submit")}
      </button>
    </form>
  );
}

function DemoSuccess({ onAnother }: { onAnother: () => void }) {
  const { t } = useI18n();
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);
  return (
    <div role="status" className="flex flex-col items-start gap-4 py-6">
      <span className="flex size-12 items-center justify-center rounded-full bg-mint">
        <CircleCheck className="size-6 text-accent-strong" aria-hidden="true" />
      </span>
      <h3
        ref={headingRef}
        tabIndex={-1}
        data-focus-target=""
        className="text-2xl font-extrabold text-slate-900"
      >
        {t("marketing.successTitle")}
      </h3>
      <p className="max-w-[48ch] leading-relaxed text-slate-700">{t("marketing.successText")}</p>
      <button type="button" onClick={onAnother} className={mkButton("quiet", "md")}>
        {t("marketing.successAnother")}
      </button>
    </div>
  );
}
