import type { ReactNode } from "react";
import { Navigate, Outlet } from "react-router";
import { ShieldAlert } from "lucide-react";
import { FullPageError } from "@/components/layout/FullPageError";
import { FullPageSpinner } from "@/components/layout/FullPageSpinner";
import { EmptyState } from "@/components/ui";
import { useI18n } from "@/i18n";
import type { MemberRole } from "./context";
import { hasRole } from "./roles";
import { useOrg } from "./useOrg";

/** Signed-in users without a clinic are sent to /onboarding. */
export function RequireOrg({ children }: { children?: ReactNode }) {
  const { current, loading, error, refresh } = useOrg();
  if (loading) return <FullPageSpinner />;
  if (error && !current)
    return <FullPageError error={error} onRetry={() => void refresh().catch(() => {})} />;
  if (!current) return <Navigate to="/onboarding" replace />;
  return children ?? <Outlet />;
}

/** Shows a "no access" message instead of the page for other roles. */
export function RequireRole({
  roles,
  children,
}: {
  roles: readonly MemberRole[];
  children?: ReactNode;
}) {
  const { role } = useOrg();
  const { t } = useI18n();
  if (!hasRole(role, roles)) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title={t("common.noAccessTitle")}
        text={t("common.noAccessText")}
      />
    );
  }
  return children ?? <Outlet />;
}
