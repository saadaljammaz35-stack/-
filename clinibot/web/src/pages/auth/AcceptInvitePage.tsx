import { useEffect, useState } from "react";
import { Unlink, UsersRound } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "@/auth/useAuth";
import { completeAuthFromUrl } from "@/auth/urlAuth";
import { PasswordStrength } from "@/components/forms/PasswordStrength";
import { AuthCard, AuthLayout, StatusIcon } from "@/components/layout/AuthLayout";
import { FullPageSpinner } from "@/components/layout/FullPageSpinner";
import { Alert, Button, ButtonLink, Field, Input, PasswordInput, useToast } from "@/components/ui";
import { useI18n } from "@/i18n";
import { describeError, errorText } from "@/lib/errors";
import { supabase } from "@/lib/supabase";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import { useForm } from "@/lib/useForm";
import { useOrg } from "@/org/useOrg";
import { acceptInviteSchema } from "./schemas";

type Phase = "checking" | "form" | "invalid";

/**
 * Landing page of the staff invitation email (SITE_URL/auth/accept-invite,
 * sent by the invite-member Edge Function). The invited person picks their
 * name and password, then goes straight to the clinic's dashboard.
 */
export default function AcceptInvitePage() {
  const { t, tRich } = useI18n();
  useDocumentTitle(t("auth.inviteTitle"));
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const { refresh } = useOrg();
  const [phase, setPhase] = useState<Phase>("checking");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm(acceptInviteSchema, { fullName: "", password: "", confirmPassword: "" });
  const { setValue } = form;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await completeAuthFromUrl();
      if (result.status === "error") {
        if (!cancelled) setPhase("invalid");
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!data.session) {
        setPhase("invalid");
        return;
      }
      const name: unknown = data.session.user.user_metadata.full_name;
      if (typeof name === "string" && name.trim()) setValue("fullName", name.trim());
      setPhase("form");
    })();
    return () => {
      cancelled = true;
    };
    // Runs once per page load; setValue changes identity as the user types.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = form.handleSubmit(async ({ fullName, password }) => {
    setFormError(null);
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password, data: { full_name: fullName } });
      if (error) {
        if (describeError(error).code === "session_expired") setPhase("invalid");
        else setFormError(errorText(t, error));
        return;
      }
      try {
        await refresh();
      } catch {
        // The dashboard shows its own retry if memberships still fail to load.
      }
      toast.success(t("auth.resetSuccess"));
      void navigate("/app", { replace: true });
    } catch (error) {
      setFormError(errorText(t, error));
    } finally {
      setSubmitting(false);
    }
  });

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
          title={t("auth.inviteInvalidTitle")}
          subtitle={t("auth.inviteInvalidText")}
          footer={
            <Link to="/forgot-password" className="font-bold text-primary hover:underline">
              {t("auth.forgotPasswordLink")}
            </Link>
          }
        >
          <ButtonLink to="/login" fullWidth size="lg" replace>
            {t("common.signIn")}
          </ButtonLink>
        </AuthCard>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <AuthCard
        icon={
          <StatusIcon>
            <UsersRound className="size-7" aria-hidden="true" />
          </StatusIcon>
        }
        title={t("auth.inviteTitle")}
        subtitle={t("auth.inviteSubtitle")}
      >
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
          {user?.email && (
            <p className="rounded-xl bg-slate-50 px-3.5 py-2.5 text-sm text-slate-700">
              {tRich("auth.invitedAs", {
                email: (
                  <bdi dir="ltr" className="font-bold text-slate-900">
                    {user.email}
                  </bdi>
                ),
              })}
            </p>
          )}
          {formError && <Alert tone="error">{formError}</Alert>}
          <input type="email" name="username" autoComplete="username" value={user?.email ?? ""} hidden readOnly />
          <Field label={t("auth.fullName")} error={form.errors.fullName && t(form.errors.fullName)} required>
            <Input
              name="name"
              autoComplete="name"
              value={form.values.fullName}
              onChange={(event) => form.setValue("fullName", event.target.value)}
            />
          </Field>
          <Field
            label={t("auth.password")}
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
            {submitting ? t("auth.saving") : t("auth.inviteSubmit")}
          </Button>
        </form>
      </AuthCard>
    </AuthLayout>
  );
}
