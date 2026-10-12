import { useEffect, useState } from "react";
import { MailCheck } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { PasswordStrength } from "@/components/forms/PasswordStrength";
import { AuthCard, AuthLayout, StatusIcon } from "@/components/layout/AuthLayout";
import { Alert, Button, Checkbox, Field, Input, PasswordInput } from "@/components/ui";
import { useI18n } from "@/i18n";
import { errorText } from "@/lib/errors";
import { supabase } from "@/lib/supabase";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import { useForm } from "@/lib/useForm";
import { authRedirectUrl, registerSchema } from "./schemas";

const RESEND_COOLDOWN_SECONDS = 60;

export default function RegisterPage() {
  const { t, tRich } = useI18n();
  useDocumentTitle(t("auth.registerTitle"));
  const navigate = useNavigate();
  const form = useForm(registerSchema, {
    fullName: "",
    email: "",
    password: "",
    acceptTerms: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const onSubmit = form.handleSubmit(async ({ fullName, email, password }) => {
    setFormError(null);
    setSubmitting(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: authRedirectUrl("/auth/callback"),
        },
      });
      if (error) {
        setFormError(errorText(t, error));
        return;
      }
      if (data.session) {
        // Email confirmation is off for this project: signed in already.
        void navigate("/onboarding", { replace: true });
        return;
      }
      // Same screen whether or not the address already had an account, so
      // the form cannot be used to discover who is registered.
      setSentTo(email);
    } catch (error) {
      setFormError(errorText(t, error));
    } finally {
      setSubmitting(false);
    }
  });

  if (sentTo) {
    return (
      <AuthLayout>
        <CheckEmail email={sentTo} onUseDifferentEmail={() => setSentTo(null)} />
      </AuthLayout>
    );
  }

  const termsLink = (
    <Link
      to="/terms"
      target="_blank"
      rel="noopener"
      className="font-bold text-primary underline-offset-2 hover:underline"
    >
      {t("auth.termsLink")}
      <span className="sr-only"> {t("common.opensInNewTab")}</span>
    </Link>
  );
  const privacyLink = (
    <Link
      to="/privacy"
      target="_blank"
      rel="noopener"
      className="font-bold text-primary underline-offset-2 hover:underline"
    >
      {t("auth.privacyLink")}
      <span className="sr-only"> {t("common.opensInNewTab")}</span>
    </Link>
  );

  return (
    <AuthLayout>
      <AuthCard
        title={t("auth.registerTitle")}
        subtitle={t("auth.registerSubtitle")}
        footer={
          <>
            {t("auth.haveAccount")}{" "}
            <Link to="/login" className="font-bold text-primary hover:underline">
              {t("common.signIn")}
            </Link>
          </>
        }
      >
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
          {formError && <Alert tone="error">{formError}</Alert>}

          <Field
            label={t("auth.fullName")}
            error={form.errors.fullName && t(form.errors.fullName)}
            required
          >
            <Input
              name="name"
              autoComplete="name"
              value={form.values.fullName}
              onChange={(event) => form.setValue("fullName", event.target.value)}
            />
          </Field>

          <Field label={t("auth.email")} error={form.errors.email && t(form.errors.email)} required>
            <Input
              type="email"
              name="email"
              dir="ltr"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              value={form.values.email}
              onChange={(event) => form.setValue("email", event.target.value)}
            />
          </Field>

          <Field
            label={t("auth.password")}
            hint={t("auth.passwordHint")}
            error={form.errors.password && t(form.errors.password)}
            required
          >
            <PasswordInput
              name="new-password"
              autoComplete="new-password"
              value={form.values.password}
              onChange={(event) => form.setValue("password", event.target.value)}
            />
            <PasswordStrength password={form.values.password} />
          </Field>

          <Checkbox
            name="accept-terms"
            checked={form.values.acceptTerms}
            onChange={(event) => form.setValue("acceptTerms", event.target.checked)}
            label={tRich("auth.acceptTerms", { terms: termsLink, privacy: privacyLink })}
            error={form.errors.acceptTerms && t(form.errors.acceptTerms)}
            required
          />

          <Button type="submit" size="lg" fullWidth loading={submitting}>
            {submitting ? t("auth.creatingAccount") : t("auth.registerSubmit")}
          </Button>
        </form>
      </AuthCard>
    </AuthLayout>
  );
}

function CheckEmail({
  email,
  onUseDifferentEmail,
}: {
  email: string;
  onUseDifferentEmail: () => void;
}) {
  const { t, tRich } = useI18n();
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function resend() {
    setSending(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: authRedirectUrl("/auth/callback") },
      });
      if (error) setMessage({ tone: "error", text: errorText(t, error) });
      else setMessage({ tone: "success", text: t("auth.confirmationResent") });
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (error) {
      setMessage({ tone: "error", text: errorText(t, error) });
    } finally {
      setSending(false);
    }
  }

  return (
    <AuthCard
      icon={
        <StatusIcon tone="success">
          <MailCheck className="size-7" aria-hidden="true" />
        </StatusIcon>
      }
      title={t("auth.checkEmailTitle")}
      subtitle={tRich("auth.checkEmailText", {
        email: (
          <bdi dir="ltr" className="font-bold text-slate-900">
            {email}
          </bdi>
        ),
      })}
      footer={
        <Link to="/login" className="font-bold text-primary hover:underline">
          {t("auth.backToLogin")}
        </Link>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm leading-relaxed text-slate-600">{t("auth.checkEmailSpam")}</p>
        {message && (
          <Alert tone={message.tone === "error" ? "error" : "success"}>{message.text}</Alert>
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={() => void resend()}
            loading={sending}
            disabled={cooldown > 0}
            fullWidth
          >
            {cooldown > 0 ? `${t("auth.resendEmail")} (${cooldown})` : t("auth.resendEmail")}
          </Button>
          <Button variant="ghost" onClick={onUseDifferentEmail} fullWidth>
            {t("auth.useDifferentEmail")}
          </Button>
        </div>
      </div>
    </AuthCard>
  );
}
