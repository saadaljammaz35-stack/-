import type { MessageKey } from "@/i18n";

/**
 * The overview's setup checklist, computed only from real state. Each check is
 * true (done), false (not done) or null (could not be checked right now, e.g.
 * the status request failed): an unknown is never shown as done.
 */
export interface SetupState {
  /** ≥1 active service or active FAQ. */
  hasKnowledge: boolean | null;
  /** clinic_settings.ai_last_test_ok (written by the server after a real AI call). */
  assistantTested: boolean | null;
  /** clinic_settings.assistant_enabled */
  assistantEnabled: boolean | null;
  /** clinic_settings.public_chat_enabled */
  publicChatEnabled: boolean | null;
  /** system-status → whatsapp.status === "connected" */
  whatsappConnected: boolean | null;
  /** list_org_members returned two or more people. */
  hasTeammate: boolean | null;
}

export type SetupItemId = keyof SetupState;

export interface SetupItem {
  id: SetupItemId;
  state: "done" | "todo" | "unknown";
  title: MessageKey;
  text: MessageKey;
  to: string;
  action: MessageKey;
}

const ITEMS: ReadonlyArray<Omit<SetupItem, "state">> = [
  {
    id: "hasKnowledge",
    title: "dashboard.setupKnowledgeTitle",
    text: "dashboard.setupKnowledgeText",
    to: "/app/knowledge",
    action: "dashboard.setupKnowledgeAction",
  },
  {
    id: "assistantTested",
    title: "dashboard.setupTestTitle",
    text: "dashboard.setupTestText",
    to: "/app/assistant",
    action: "dashboard.setupTestAction",
  },
  {
    id: "assistantEnabled",
    title: "dashboard.setupEnableTitle",
    text: "dashboard.setupEnableText",
    to: "/app/assistant",
    action: "dashboard.setupEnableAction",
  },
  {
    id: "publicChatEnabled",
    title: "dashboard.setupWebChatTitle",
    text: "dashboard.setupWebChatText",
    to: "/app/assistant",
    action: "dashboard.setupWebChatAction",
  },
  {
    id: "whatsappConnected",
    title: "dashboard.setupWhatsappTitle",
    text: "dashboard.setupWhatsappText",
    to: "/app/whatsapp",
    action: "dashboard.setupWhatsappAction",
  },
  {
    id: "hasTeammate",
    title: "dashboard.setupTeamTitle",
    text: "dashboard.setupTeamText",
    to: "/app/staff",
    action: "dashboard.setupTeamAction",
  },
];

export function setupChecklist(state: SetupState): SetupItem[] {
  return ITEMS.map((item) => {
    const value = state[item.id];
    return { ...item, state: value === true ? "done" : value === false ? "todo" : "unknown" };
  });
}

export function setupProgress(items: readonly SetupItem[]): {
  done: number;
  total: number;
  complete: boolean;
} {
  const done = items.filter((item) => item.state === "done").length;
  return { done, total: items.length, complete: done === items.length };
}
