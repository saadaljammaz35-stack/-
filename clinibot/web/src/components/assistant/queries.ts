import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { callFunction } from "@/lib/api";
import { queryKeys } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
import { ensureAffected } from "@/components/knowledge/queries";
import { settingsKeys } from "@/components/settings/queries";
import {
  classifyTestError,
  parseSystemStatus,
  parseTestResult,
  type AssistantSettingsPayload,
  type SystemStatus,
  type TestMessage,
  type TestResult,
  type Tone,
} from "./model";

export const assistantKeys = {
  /** Shared by the assistant and WhatsApp pages. */
  systemStatus: (orgId: string) => [...queryKeys.org(orgId), "system-status"] as const,
  settings: (orgId: string) => [...queryKeys.org(orgId), "assistant", "settings"] as const,
};

export function useSystemStatus(
  orgId: string,
  options: {
    /** Poll while the returned value is a number, e.g. while waiting for Meta's webhook check. */
    refetchInterval?: (status: SystemStatus | undefined) => number | false;
  } = {},
) {
  const interval = options.refetchInterval;
  return useQuery({
    queryKey: assistantKeys.systemStatus(orgId),
    queryFn: async (): Promise<SystemStatus> =>
      parseSystemStatus(
        await callFunction<unknown>(
          "system-status",
          { organization_id: orgId },
          { timeout: 20_000 },
        ),
      ),
    refetchInterval: interval ? (query) => interval(query.state.data) : false,
  });
}

/**
 * Refreshes every cached copy of the status (this page, the WhatsApp page, the
 * overview checklist) and of clinic_settings (the Settings page's chat link card).
 */
export function useInvalidateStatus(orgId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: assistantKeys.systemStatus(orgId) }),
      queryClient.invalidateQueries({ queryKey: assistantKeys.settings(orgId) }),
      queryClient.invalidateQueries({ queryKey: settingsKeys.clinic(orgId) }),
      queryClient.invalidateQueries({ queryKey: [...queryKeys.org(orgId), "dashboard"] }),
    ]);
}

export interface AssistantSettings {
  assistantName: string;
  assistantTone: Tone;
  welcomeMessageAr: string | null;
  welcomeMessageEn: string | null;
  extraInstructions: string | null;
  emergencyNumber: string;
  assistantEnabled: boolean;
  publicChatEnabled: boolean;
  lastTestAt: string | null;
  lastTestOk: boolean | null;
}

export function useAssistantSettings(orgId: string) {
  return useQuery({
    queryKey: assistantKeys.settings(orgId),
    queryFn: async (): Promise<AssistantSettings | null> => {
      const { data, error } = await supabase
        .from("clinic_settings")
        .select(
          "assistant_name, assistant_tone, welcome_message_ar, welcome_message_en, extra_instructions, emergency_number, assistant_enabled, public_chat_enabled, ai_last_test_at, ai_last_test_ok",
        )
        .eq("organization_id", orgId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        assistantName: data.assistant_name,
        assistantTone: data.assistant_tone === "formal" ? "formal" : "friendly",
        welcomeMessageAr: data.welcome_message_ar,
        welcomeMessageEn: data.welcome_message_en,
        extraInstructions: data.extra_instructions,
        emergencyNumber: data.emergency_number,
        assistantEnabled: data.assistant_enabled,
        publicChatEnabled: data.public_chat_enabled,
        lastTestAt: data.ai_last_test_at,
        lastTestOk: data.ai_last_test_ok,
      };
    },
  });
}

type SettingsPatch =
  AssistantSettingsPayload | { assistant_enabled: boolean } | { public_chat_enabled: boolean };

async function updateSettings(orgId: string, patch: SettingsPatch): Promise<void> {
  const { data, error } = await supabase
    .from("clinic_settings")
    .update(patch)
    .eq("organization_id", orgId)
    .select("organization_id");
  if (error) throw error;
  ensureAffected(data);
}

export function useSaveAssistantSettings(orgId: string) {
  const invalidate = useInvalidateStatus(orgId);
  return useMutation({
    mutationFn: (payload: AssistantSettingsPayload) => updateSettings(orgId, payload),
    onSuccess: invalidate,
    meta: { silentError: true, successMessage: "assistant.settingsSaved" },
  });
}

export function useSetAssistantFlag(orgId: string) {
  const invalidate = useInvalidateStatus(orgId);
  return useMutation({
    mutationFn: (patch: { assistant_enabled: boolean } | { public_chat_enabled: boolean }) =>
      updateSettings(orgId, patch),
    onSettled: invalidate,
    meta: { silentError: true },
  });
}

/**
 * After a test timed out, when to read the status again: the gateway lets the
 * function run 150 s, 30 s past the browser's 120 s, and it still writes
 * ai_last_test_at/ok and the usage when it finishes.
 */
const LATE_TEST_RESULT_MS = 35_000;

export function useAssistantTest(orgId: string) {
  const invalidate = useInvalidateStatus(orgId);
  return useMutation({
    mutationFn: async (messages: TestMessage[]): Promise<TestResult> =>
      parseTestResult(
        await callFunction<unknown>(
          "assistant-test",
          { organization_id: orgId, messages },
          { timeout: 120_000 },
        ),
      ),
    // A test writes ai_last_test_at/ok (and usage) on the server, whatever the outcome.
    onSettled: invalidate,
    onError: (error) => {
      if (classifyTestError(error) === "timeout") {
        setTimeout(() => void invalidate(), LATE_TEST_RESULT_MS);
      }
    },
    meta: { silentError: true },
  });
}
