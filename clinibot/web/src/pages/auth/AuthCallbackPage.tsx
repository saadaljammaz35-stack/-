import { useEffect, useState } from "react";
import { Unlink } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "@/auth/useAuth";
import { completeAuthFromUrl } from "@/auth/urlAuth";
import { AuthCard, AuthLayout, StatusIcon } from "@/components/layout/AuthLayout";
import { FullPageSpinner } from "@/components/layout/FullPageSpinner";
import { ButtonLink } from "@/components/ui";
import { useI18n } from "@/i18n";
import { supabase } from "@/lib/supabase";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import { useOrg } from "@/org/useOrg";

type Phase = "checking" | "signed-in" | "failed";

/**
 * Where email-confirmation links land (emailRedirectTo …/auth/callback).
 * Completes the sign-in, then continues to /app, or /onboarding for a new
 * account without a clinic.
 */
export default function AuthCallbackPage() {
  const { t } = useI18n();
  useDocumentTitle(t("auth.callbackTitle"));
  const navigate = useNavigate();
  const { user } = useAuth();
  const { orgs, loading: orgsLoading, error: orgsError } = useOrg();
  const [phase, setPhase] = useState<Phase>("checking");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await completeAuthFromUrl();
      if (cancelled) return;
      if (result.status === "error") {
        setPhase("failed");
        return;
      }
      if (result.status === "session" && result.type === "recovery") {
        void navigate("/reset-password", { replace: true });
        return;
      }
      if (result.status === "session" && result.type === "invite") {
        void navigate("/auth/accept-invite", { replace: true });
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (!cancelled) setPhase(data.session ? "signed-in" : "failed");
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  // Once signed in and memberships are known, pick the destination.
  useEffect(() => {
    if (phase !== "signed-in" || !user || orgsLoading) return;
    void navigate(orgs.length > 0 || orgsError ? "/app" : "/onboarding", { replace: true });
  }, [phase, user, orgs, orgsLoading, orgsError, navigate]);

  if (phase === "failed") {
    return (
      <AuthLayout>
        <AuthCard
          icon={
            <StatusIcon tone="warning">
              <Unlink className="size-7" aria-hidden="true" />
            </StatusIcon>
          }
          title={t("auth.callbackFailedTitle")}
          subtitle={t("auth.callbackFailedText")}
          footer={
            <Link to="/register" className="font-bold text-primary hover:underline">
              {t("auth.createAccountLink")}
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
      <div className="flex flex-col items-center gap-3 py-16 text-slate-600">
        <FullPageSpinner inline />
        <p>{t("auth.callbackTitle")}</p>
      </div>
    </AuthLayout>
  );
}
