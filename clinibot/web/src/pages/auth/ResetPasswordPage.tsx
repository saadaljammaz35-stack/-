import { useEffect, useState } from "react";
import { CircleCheck, Unlink } from "lucide-react";
import { Link } from "react-router";
import { PasswordStrength } from "@/components/forms/PasswordStrength";
import { AuthCard, AuthLayout, StatusIcon } from "@/components/layout/AuthLayout";
import { FullPageSpinner } from "@/components/layout/FullPageSpinner";
import { Alert, Button, ButtonLink, Field, PasswordInput } from "@/components/ui";
import { completeAuthFromUrl, type UrlAuthResult } from "@/auth/urlAuth";
import { useI18n } from "@/i18n";
import { describeError, errorText } from "@/lib/errors";
import { supabase } from "@/lib/supabase";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import { useForm } from "@/lib/useForm";
import { LinkConflict } from "./LinkConflict";
import { resetSchema } from "./schemas";

type Phase = "checking" | "form" | "invalid" | "conflict" | "done";

/** Landing page of the password-recovery email (redirectTo …/reset-password). */
export default function ResetPasswordPage() {
  const { t } = useI18n();
  useDocumentTitle(t("auth.resetTitle"));
  const [phase, setPhase] = useState<Phase>("checking");
  const form = useForm(resetSchema, { password: "", confirmPassword: "" });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [conflictEmail, setConflictEmail] = useState<string | null>(null);
  const [usedInvite, setUsedInvite] = useState(false);

  async function apply(result: UrlAuthResult, isCancelled: () => boolean = () => false) {
    if (result.status === "error") {
      if (!isCancelled()) setPhase("invalid");
      return;
    }
    if (result.status === "conflict") {
      if (isCancelled()) return;
      setConflictEmail(result.email);
      setUsedInvite(result.usedInvite);
      setPhase("conflict");
      return;
    }
    const { data } = await supabase.auth.getSession();
    if (!isCancelled()) setPhase(data.session ? "form" : "invalid");
  }

  useEffect(() => {
    let cancelled = false;
    void completeAuthFromUrl().then((result) => apply(result, () => cancelled));
    return () => {
      cancelled = true;
    };
    // Runs once per page load.
  }, []);

  const onSubmit = form.handleSubmit(async ({ password }) => {
    setFormError(null);
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        if (describeError(error).code === "session_expired") setPhase("invalid");
        else setFormError(errorText(t, error));
        return;
      }
      setPhase("done");
    } catch (error) {
      setFormError(errorText(t, error));
    } finally {
      setSubmitting(false);
    }
  });

  if (phase === "conflict") {
    return (
      <LinkConflict
        email={conflictEmail}
        usedInvite={usedInvite}
        onResolved={(result) => void apply(result)}
      />
    );
  }

  if (phase === "checking") {
    return (
      <AuthLayout>
        <div className="flex flex-col items-center gap-3 py-16 text-slate-600">
          <FullPageSpinner inline />
          <p>{t("auth.verifyingLink")}</p>
        </div>
      </AuthLayout>
    );
  }

  if (phase === "invalid") {
    return (
      <AuthLayout>
        <AuthCard
          icon={
            <StatusIcon tone="warning">
              <Unlink className="size-7" aria-hidden="true" />
            </StatusIcon>
          }
          title={t("auth.linkExpiredTitle")}
          subtitle={t("auth.linkExpiredText")}
          footer={
            <Link to="/login" className="font-bold text-primary hover:underline">
              {t("auth.backToLogin")}
            </Link>
          }
        >
          <ButtonLink to="/forgot-password" fullWidth size="lg">
            {t("auth.requestNewLink")}
          </ButtonLink>
        </AuthCard>
      </AuthLayout>
    );
  }

  if (phase === "done") {
    return (
      <AuthLayout>
        <AuthCard
          icon={
            <StatusIcon tone="success">
              <CircleCheck className="size-7" aria-hidden="true" />
            </StatusIcon>
          }
          title={t("auth.resetSuccess")}
        >
          <ButtonLink to="/app" fullWidth size="lg" replace>
            {t("common.goToDashboard")}
          </ButtonLink>
        </AuthCard>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <AuthCard title={t("auth.resetTitle")} subtitle={t("auth.resetSubtitle")}>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
          {formError && <Alert tone="error">{formError}</Alert>}
          {/* Lets password managers attach the new password to the right account. */}
          <input type="text" name="username" autoComplete="username" hidden readOnly />
          <Field
            label={t("auth.newPassword")}
            hint={t("auth.passwordHint")}
            error={form.errors.password && t(form.errors.password)}
            required
          >
            <PasswordInput
              autoComplete="new-password"
              value={form.values.password}
              onChange={(event) => form.setValue("password", event.target.value)}
            />
            <PasswordStrength password={form.values.password} />
          </Field>
          <Field
            label={t("auth.confirmPassword")}
            error={form.errors.confirmPassword && t(form.errors.confirmPassword)}
            required
          >
            <PasswordInput
              autoComplete="new-password"
              value={form.values.confirmPassword}
              onChange={(event) => form.setValue("confirmPassword", event.target.value)}
            />
          </Field>
          <Button type="submit" size="lg" fullWidth loading={submitting}>
            {submitting ? t("auth.saving") : t("auth.resetSubmit")}
          </Button>
        </form>
      </AuthCard>
    </AuthLayout>
  );
}
