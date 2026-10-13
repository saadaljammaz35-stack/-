import { Sparkles } from "lucide-react";
import { useSearchParams } from "react-router";
import { Card, EmptyState, PageHeader, buttonClasses } from "@/components/ui";
import { MetricsSection } from "@/components/dashboard/MetricsSection";
import { isPeriod, type Period } from "@/components/dashboard/metrics";
import {
  useDashboardMetrics,
  useRecentAppointments,
  useRecentConversations,
} from "@/components/dashboard/queries";
import { RecentAppointments, RecentConversations } from "@/components/dashboard/RecentActivity";
import { SetupChecklist } from "@/components/dashboard/SetupChecklist";
import { setupProgress } from "@/components/dashboard/setup";
import { useSetupItems } from "@/components/dashboard/useSetupItems";
import { useI18n } from "@/i18n";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import { useCurrentOrg } from "@/org/useOrg";

const DEFAULT_PERIOD: Period = 30;

/** /app: the clinic's activity at a glance, plus what is left to set up. */
export default function OverviewPage() {
  const { t } = useI18n();
  const org = useCurrentOrg();
  useDocumentTitle(t("dashboard.title"));
  const [params, setParams] = useSearchParams();
  const raw = Number(params.get("days"));
  const days: Period = isPeriod(raw) ? raw : DEFAULT_PERIOD;

  const metrics = useDashboardMetrics(org.id, days);
  const recentConversations = useRecentConversations(org.id);
  const recentAppointments = useRecentAppointments(org.id);
  const setup = useSetupItems(org.id);
  const progress = setupProgress(setup.items);
  const setupKnown = !setup.loading;

  // Never had a conversation or an appointment request (the recent lists are not period-bound).
  const brandNew = recentConversations.data?.length === 0 && recentAppointments.data?.length === 0;

  function setDays(next: Period) {
    setParams(
      (current) => {
        const updated = new URLSearchParams(current);
        if (next === DEFAULT_PERIOD) updated.delete("days");
        else updated.set("days", String(next));
        return updated;
      },
      { replace: true },
    );
  }

  const checklist = <SetupChecklist setup={setup} />;
  const showChecklistFirst = !setupKnown || !progress.complete;

  return (
    <>
      <PageHeader
        title={t("dashboard.title")}
        description={t("dashboard.welcome", { clinic: org.name })}
      />
      <div className="flex flex-col gap-6">
        {brandNew && (
          <Card>
            <EmptyState
              icon={Sparkles}
              title={t("dashboard.emptyTitle")}
              text={
                progress.complete ? t("dashboard.emptyTextReady") : t("dashboard.emptyTextSetup")
              }
              action={
                !progress.complete && (
                  <a href="#setup" className={buttonClasses({ variant: "primary" })}>
                    {t("dashboard.emptyAction")}
                  </a>
                )
              }
            />
          </Card>
        )}

        {showChecklistFirst && checklist}

        <MetricsSection query={metrics} days={days} onDaysChange={setDays} />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <RecentConversations query={recentConversations} />
          <RecentAppointments query={recentAppointments} />
        </div>

        {!showChecklistFirst && checklist}
      </div>
    </>
  );
}
