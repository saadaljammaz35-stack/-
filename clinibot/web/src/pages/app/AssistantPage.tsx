import { Alert, PageHeader } from "@/components/ui";
import { ActivationCard } from "@/components/assistant/ActivationCard";
import { AssistantSettingsCard } from "@/components/assistant/AssistantSettingsCard";
import { AssistantStatusCard } from "@/components/assistant/AssistantStatusCard";
import { NotConfiguredPanel } from "@/components/assistant/NotConfiguredPanel";
import { useSystemStatus } from "@/components/assistant/queries";
import { TestConsole } from "@/components/assistant/TestConsole";
import { useI18n } from "@/i18n";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import { canManage } from "@/org/roles";
import { useCurrentOrg } from "@/org/useOrg";

/** /app/assistant — status, switching on, the test console and behaviour settings. */
export default function AssistantPage() {
  const { t } = useI18n();
  const org = useCurrentOrg();
  const canEdit = canManage(org.role);
  const status = useSystemStatus(org.id);
  const now = new Date();
  useDocumentTitle(t("assistant.title"));

  const refresh = () => void status.refetch();

  return (
    <>
      <PageHeader title={t("assistant.title")} description={t("assistant.description")} />

      {status.data && !status.data.ai.configured && (
        <div className="mb-6">
          <NotConfiguredPanel onRefresh={refresh} refreshing={status.isFetching} />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <AssistantStatusCard
          status={status.data}
          loading={status.isPending}
          error={status.error}
          refreshing={status.isFetching}
          onRefresh={refresh}
          now={now}
        />
        <ActivationCard
          orgId={org.id}
          slug={org.slug}
          canEdit={canEdit}
          ai={status.data?.ai}
          entitlements={status.data?.entitlements}
          now={now}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2 xl:items-start">
        {canEdit ? (
          <TestConsole key={org.id} orgId={org.id} status={status.data} />
        ) : (
          <Alert tone="info" title={t("assistant.testTitle")}>
            {t("assistant.testManagersOnly")}
          </Alert>
        )}
        <AssistantSettingsCard orgId={org.id} canEdit={canEdit} />
      </div>
    </>
  );
}
