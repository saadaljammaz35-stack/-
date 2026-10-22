import { useState } from "react";
import { UserRoundCheck } from "lucide-react";
import { useNavigate } from "react-router";
import { useAuth } from "@/auth/useAuth";
import { retryAuthFromUrl, type UrlAuthResult } from "@/auth/urlAuth";
import { AuthCard, AuthLayout, StatusIcon } from "@/components/layout/AuthLayout";
import { Button, ButtonLink } from "@/components/ui";
import { useI18n } from "@/i18n";

/**
 * Shown when an email link (token hash or invitation tokens) is opened while
 * someone is already signed in. The link is only used after that person signs
 * out, so a link can never silently switch the account in use.
 */
export function LinkConflict({
  email,
  onResolved,
}: {
  email: string | null;
  onResolved: (result: UrlAuthResult) => void;
}) {
  const { t, tRich } = useI18n();
  const { signOut } = useAuth();
  const [busy, setBusy] = useState(false);

  async function signOutAndContinue() {
    setBusy(true);
    try {
      await signOut();
      onResolved(await retryAuthFromUrl());
    } catch {
      onResolved({ status: "error", code: null, description: null });
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <AuthCard
        icon={
          <StatusIcon tone="warning">
            <UserRoundCheck className="size-7" aria-hidden="true" />
          </StatusIcon>
        }
        title={t("auth.linkConflictTitle")}
        subtitle={
          email
            ? tRich("auth.linkConflictText", {
                email: (
                  <bdi dir="ltr" className="font-bold text-slate-900">
                    {email}
                  </bdi>
                ),
              })
            : t("auth.linkConflictTextNoEmail")
        }
      >
        <div className="flex flex-col gap-3">
          <Button fullWidth size="lg" loading={busy} onClick={() => void signOutAndContinue()}>
            {t("auth.linkConflictSignOut")}
          </Button>
          <ButtonLink to="/app" variant="outline" fullWidth size="lg" replace>
            {t("auth.linkConflictStay")}
          </ButtonLink>
        </div>
      </AuthCard>
    </AuthLayout>
  );
}

/**
 * After a sign-in that came from credentials inside the link (not this
 * browser's own PKCE code), say which account is now signed in before going on.
 */
export function SignedInFromLink({
  email,
  onContinue,
}: {
  email: string | null;
  onContinue: () => void;
}) {
  const { t, tRich } = useI18n();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  return (
    <AuthLayout>
      <AuthCard
        icon={
          <StatusIcon tone="success">
            <UserRoundCheck className="size-7" aria-hidden="true" />
          </StatusIcon>
        }
        title={t("auth.signedInFromLinkTitle")}
        subtitle={
          email
            ? tRich("auth.signedInAs", {
                email: (
                  <bdi dir="ltr" className="font-bold text-slate-900">
                    {email}
                  </bdi>
                ),
              })
            : undefined
        }
      >
        <div className="flex flex-col gap-3">
          <Button fullWidth size="lg" onClick={onContinue} disabled={busy}>
            {t("common.continue")}
          </Button>
          <Button
            variant="outline"
            fullWidth
            size="lg"
            loading={busy}
            onClick={() => {
              setBusy(true);
              void signOut()
                .then(() => navigate("/login", { replace: true }))
                .finally(() => setBusy(false));
            }}
          >
            {t("common.signOut")}
          </Button>
        </div>
      </AuthCard>
    </AuthLayout>
  );
}
