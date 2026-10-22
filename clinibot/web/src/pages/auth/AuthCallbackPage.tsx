import { useCallback, useEffect, useState } from "react";
import { Unlink } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "@/auth/useAuth";
import { completeAuthFromUrl, type UrlAuthResult } from "@/auth/urlAuth";
import { AuthCard, AuthLayout, StatusIcon } from "@/components/layout/AuthLayout";
import { FullPageSpinner } from "@/components/layout/FullPageSpinner";
import { ButtonLink } from "@/components/ui";
import { useI18n } from "@/i18n";
import { supabase } from "@/lib/supabase";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import { useOrg } from "@/org/useOrg";
import { LinkConflict, SignedInFromLink } from "./LinkConflict";

type Phase = "checking" | "confirm" | "conflict" | "signed-in" | "failed";

/**
 * Where email-confirmation links land (emailRedirectTo …/auth/callback).
 * Completes the sign-in, then continues to /app, or /onboarding for a new
 * account without a clinic. A session that came from credentials inside the
 * link (not this browser's PKCE code) is confirmed with the person first.
 */
export default function AuthCallbackPage() {
  const { t } = useI18n();
  useDocumentTitle(t("auth.callbackTitle"));
  const navigate = useNavigate();
  const { user } = useAuth();
  const { orgs, loading: orgsLoading, error: orgsError } = useOrg();
  const [phase, setPhase] = useState<Phase>("checking");
  const [conflictEmail, setConflictEmail] = useState<string | null>(null);
  const [usedInvite, setUsedInvite] = useState(false);

  const apply = useCallback(
    async (result: UrlAuthResult, isCancelled: () => boolean = () => false) => {
      if (isCancelled()) return;
      if (result.status === "error") {
        setPhase("failed");
        return;
      }
      if (result.status === "conflict") {
        setConflictEmail(result.email);
        setUsedInvite(result.usedInvite);
        setPhase("conflict");
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
      if (result.status === "session" && result.via === "link") {
        setPhase("confirm");
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (!isCancelled()) setPhase(data.session ? "signed-in" : "failed");
    },
    [navigate],
  );

  useEffect(() => {
    let cancelled = false;
    void completeAuthFromUrl().then((result) => apply(result, () => cancelled));
    return () => {
      cancelled = true;
    };
  }, [apply]);

  // Once signed in and memberships are known, pick the destination.
  useEffect(() => {
    if (phase !== "signed-in" || !user || orgsLoading) return;
    void navigate(orgs.length > 0 || orgsError ? "/app" : "/onboarding", { replace: true });
  }, [phase, user, orgs, orgsLoading, orgsError, navigate]);

  if (phase === "conflict") {
    return (
      <LinkConflict
        email={conflictEmail}
        usedInvite={usedInvite}
        onResolved={(result) => void apply(result)}
      />
    );
  }

  if (phase === "confirm" && user) {
    return <SignedInFromLink email={user.email ?? null} onContinue={() => setPhase("signed-in")} />;
  }

  if (phase === "failed") return <FailedCard />;

  return (
    <AuthLayout>
      <div className="flex flex-col items-center gap-3 py-16 text-slate-600">
        <FullPageSpinner inline />
        <p>{t("auth.callbackTitle")}</p>
      </div>
    </AuthLayout>
  );
}

function FailedCard() {
  const { t } = useI18n();
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
