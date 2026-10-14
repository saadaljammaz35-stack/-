import { CreditCard } from "lucide-react";
import { CurrentPlanCard } from "@/components/billing/CurrentPlanCard";
import { PaymentsNotice } from "@/components/billing/PaymentsNotice";
import { PlansGrid } from "@/components/billing/PlansGrid";
import {
  useEntitlements,
  useLatestSubscription,
  usePlans,
  useUsageHistory,
} from "@/components/billing/queries";
import { UsageHistory } from "@/components/billing/UsageHistory";
import { EmptyState, PageHeader } from "@/components/ui";
import { useI18n } from "@/i18n";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import { canManage } from "@/org/roles";
import { useCurrentOrg } from "@/org/useOrg";

/**
 * /app/billing (owners and admins): plan, trial, usage and the published
 * plans. Payments are not integrated, so there is no checkout: upgrades go
 * through the CliniBot team.
 */
export default function BillingPage() {
  const { t } = useI18n();
  const org = useCurrentOrg();
  useDocumentTitle(t("billing.title"));
  const allowed = canManage(org.role);

  const entitlements = useEntitlements(org.id);
  const subscription = useLatestSubscription(org.id, allowed);
  const plans = usePlans(allowed);
  const usage = useUsageHistory(org.id, allowed);

  if (!allowed) {
    return (
      <>
        <PageHeader title={t("billing.title")} description={t("billing.description")} />
        <EmptyState
          icon={CreditCard}
          title={t("billing.noAccessTitle")}
          text={t("billing.noAccessText")}
        />
      </>
    );
  }

  const currentPlan = subscription.data?.plan ?? entitlements.data?.plan ?? null;

  return (
    <>
      <PageHeader title={t("billing.title")} description={t("billing.description")} />
      <div className="flex flex-col gap-6">
        <PaymentsNotice />
        <CurrentPlanCard
          entitlements={{
            data: entitlements.data,
            error: entitlements.error ?? subscription.error,
            refetch: () => {
              void entitlements.refetch();
              void subscription.refetch();
            },
          }}
          subscription={subscription.data}
          plans={plans.data}
          loading={entitlements.isPending || subscription.isPending}
        />
        <PlansGrid
          plans={plans.data}
          loading={plans.isPending}
          error={plans.error}
          onRetry={() => void plans.refetch()}
          currentPlan={currentPlan}
        />
        <UsageHistory
          rows={usage.data}
          loading={usage.isPending}
          error={usage.error}
          onRetry={() => void usage.refetch()}
        />
      </div>
    </>
  );
}
