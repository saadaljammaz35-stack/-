import { useState } from "react";
import { isAuthApiError } from "@supabase/supabase-js";
import { MailCheck } from "lucide-react";
import { Link } from "react-router";
import { AuthCard, AuthLayout, StatusIcon } from "@/components/layout/AuthLayout";
import { Alert, Button, Field, Input } from "@/components/ui";
import { useI18n } from "@/i18n";
import { errorText } from "@/lib/errors";
import { supabase } from "@/lib/supabase";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import { useForm } from "@/lib/useForm";
import { authRedirectUrl, forgotSchema } from "./schemas";

export default function ForgotPasswordPage() {
  const { t, tRich } = useI18n();
  useDocumentTitle(t("auth.forgotTitle"));
  const form = useForm(forgotSchema, { email: "" });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const onSubmit = form.handleSubmit(async ({ email }) => {
    setFormError(null);
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: authRedirectUrl("/reset-password"),
      });
      // Any answer from the server (sent, unknown address, per-address rate
      // limit, …) shows the same neutral confirmation, so this form cannot
      // reveal whether an account exists. Only "couldn't reach the server"
      // is reported, because then nothing was sent at all.
      if (error && !isAuthApiError(error)) {
        setFormError(errorText(t, error));
        return;
      }
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
        <AuthCard
          icon={
            <StatusIcon tone="success">
              <MailCheck className="size-7" aria-hidden="true" />
            </StatusIcon>
          }
          title={t("auth.forgotSentTitle")}
          subtitle={tRich("auth.forgotSentText", {
            email: (
              <bdi dir="ltr" className="font-bold text-slate-900">
                {sentTo}
              </bdi>
            ),
          })}
          footer={
            <Link to="/login" className="font-bold text-primary hover:underline">
              {t("auth.backToLogin")}
            </Link>
          }
        >
          <p className="text-sm leading-relaxed text-slate-600">{t("auth.forgotSentHint")}</p>
        </AuthCard>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <AuthCard
        title={t("auth.forgotTitle")}
        subtitle={t("auth.forgotSubtitle")}
        footer={
          <Link to="/login" className="font-bold text-primary hover:underline">
            {t("auth.backToLogin")}
          </Link>
        }
      >
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
          {formError && <Alert tone="error">{formError}</Alert>}
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
          <Button type="submit" size="lg" fullWidth loading={submitting}>
            {submitting ? t("auth.sending") : t("auth.forgotSubmit")}
          </Button>
        </form>
      </AuthCard>
    </AuthLayout>
  );
}
