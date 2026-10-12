import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { AuthCard, AuthLayout } from "@/components/layout/AuthLayout";
import { Alert, Button, Field, Input, PasswordInput } from "@/components/ui";
import { useI18n } from "@/i18n";
import { errorText } from "@/lib/errors";
import { supabase } from "@/lib/supabase";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import { useForm } from "@/lib/useForm";
import { safeNextPath } from "@/lib/validation";
import { authRedirectUrl, loginSchema } from "./schemas";

export default function LoginPage() {
  const { t } = useI18n();
  useDocumentTitle(t("auth.loginTitle"));
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNextPath(params.get("next"));
  const form = useForm(loginSchema, { email: "", password: "" });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);
  const [resend, setResend] = useState<"idle" | "sending" | "sent">("idle");

  const onSubmit = form.handleSubmit(async ({ email, password }) => {
    setFormError(null);
    setUnconfirmedEmail(null);
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        if (error.code === "email_not_confirmed") setUnconfirmedEmail(email);
        else setFormError(errorText(t, error));
        setSubmitting(false);
        return;
      }
      void navigate(next, { replace: true });
    } catch (error) {
      setFormError(errorText(t, error));
      setSubmitting(false);
    }
  });

  async function resendConfirmation() {
    if (!unconfirmedEmail) return;
    setResend("sending");
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: unconfirmedEmail,
      options: { emailRedirectTo: authRedirectUrl("/auth/callback") },
    });
    if (error) {
      setFormError(errorText(t, error));
      setResend("idle");
      return;
    }
    setResend("sent");
  }

  return (
    <AuthLayout>
      <AuthCard
        title={t("auth.loginTitle")}
        subtitle={t("auth.loginSubtitle")}
        footer={
          <>
            {t("auth.noAccount")}{" "}
            <Link to="/register" className="font-bold text-primary hover:underline">
              {t("auth.createAccountLink")}
            </Link>
          </>
        }
      >
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
          {formError && <Alert tone="error">{formError}</Alert>}
          {unconfirmedEmail && (
            <Alert
              tone="warning"
              title={t("errors.email_not_confirmed")}
              action={
                resend === "sent" ? undefined : (
                  <Button
                    size="sm"
                    variant="outline"
                    loading={resend === "sending"}
                    onClick={() => void resendConfirmation()}
                  >
                    {t("auth.resendConfirmation")}
                  </Button>
                )
              }
            >
              {resend === "sent" ? t("auth.confirmationResent") : t("auth.emailNotConfirmedHelp")}
            </Alert>
          )}

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
            error={form.errors.password && t(form.errors.password)}
            required
          >
            <PasswordInput
              name="password"
              autoComplete="current-password"
              value={form.values.password}
              onChange={(event) => form.setValue("password", event.target.value)}
            />
          </Field>

          <div className="-mt-2 flex justify-end">
            <Link
              to="/forgot-password"
              className="inline-flex min-h-11 items-center text-sm font-bold text-primary hover:underline"
            >
              {t("auth.forgotPasswordLink")}
            </Link>
          </div>

          <Button type="submit" size="lg" fullWidth loading={submitting}>
            {submitting ? t("auth.signingIn") : t("auth.loginSubmit")}
          </Button>
        </form>
      </AuthCard>
    </AuthLayout>
  );
}
