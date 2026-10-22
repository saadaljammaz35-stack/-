import { useOrgMembers } from "./members";
import { useClinicSettingsFlags, useKnowledgeCount, useSystemStatus } from "./queries";
import { setupChecklist, testStepDone, whatsappReceiving, type SetupItem } from "./setup";

export interface SetupItemsState {
  items: SetupItem[];
  loading: boolean;
  failures: Array<{ error: unknown }>;
  retry: () => void;
}

/** The real setup state of the clinic; `null` per check while unknown. */
export function useSetupItems(orgId: string): SetupItemsState {
  const settings = useClinicSettingsFlags(orgId);
  const knowledge = useKnowledgeCount(orgId);
  const status = useSystemStatus(orgId);
  const members = useOrgMembers(orgId);

  const items = setupChecklist({
    hasKnowledge: knowledge.data ? knowledge.data.services + knowledge.data.faqs > 0 : null,
    assistantTested: settings.data ? testStepDone(settings.data, new Date()) : null,
    assistantEnabled: settings.data ? settings.data.assistantEnabled : null,
    publicChatEnabled: settings.data ? settings.data.publicChatEnabled : null,
    whatsappConnected: status.data ? whatsappReceiving(status.data.whatsapp) : null,
    hasTeammate: members.data ? members.data.length >= 2 : null,
  });
  const loading =
    settings.isPending || knowledge.isPending || status.isPending || members.isPending;
  const failures = [settings, knowledge, status, members].filter((query) => query.error);
  return {
    items,
    loading,
    failures,
    retry: () => {
      for (const query of failures) void query.refetch();
    },
  };
}
