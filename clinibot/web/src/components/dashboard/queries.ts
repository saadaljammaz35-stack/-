import { useQuery } from "@tanstack/react-query";
import { callFunction } from "@/lib/api";
import { queryKeys } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
import { keepWithinOrg } from "./db";
import { parseDashboardMetrics, type Period } from "./metrics";

/** Everything the overview caches lives under these keys (mutations elsewhere invalidate them). */
export const dashboardKeys = {
  all: (orgId: string) => [...queryKeys.org(orgId), "dashboard"] as const,
  metrics: (orgId: string, days: Period) =>
    [...queryKeys.org(orgId), "dashboard", "metrics", days] as const,
  settings: (orgId: string) => [...queryKeys.org(orgId), "dashboard", "settings"] as const,
  knowledge: (orgId: string) => [...queryKeys.org(orgId), "dashboard", "knowledge"] as const,
  systemStatus: (orgId: string) => [...queryKeys.org(orgId), "dashboard", "system-status"] as const,
  // Under the sections' own prefixes so their mutations refresh these lists too.
  recentConversations: (orgId: string) =>
    [...queryKeys.org(orgId), "conversations", "recent"] as const,
  recentAppointments: (orgId: string) =>
    [...queryKeys.org(orgId), "appointments", "recent"] as const,
};

export function useDashboardMetrics(orgId: string, days: Period) {
  return useQuery({
    queryKey: dashboardKeys.metrics(orgId, days),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("dashboard_metrics", {
        p_org: orgId,
        p_days: days,
      });
      if (error) throw error;
      return parseDashboardMetrics(data);
    },
    // Switching the period keeps the previous numbers on screen (dimmed) until the new ones arrive.
    placeholderData: keepWithinOrg(orgId),
    refetchInterval: 60_000,
  });
}

export function useRecentConversations(orgId: string) {
  return useQuery({
    queryKey: dashboardKeys.recentConversations(orgId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select(
          "id, channel, status, customer_name, customer_wa_id, last_message_at, last_message_direction, created_at",
        )
        .eq("organization_id", orgId)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data;
    },
    refetchInterval: 60_000,
  });
}

export function useRecentAppointments(orgId: string) {
  return useQuery({
    queryKey: dashboardKeys.recentAppointments(orgId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointment_requests")
        .select("id, customer_name, status, source, created_at, scheduled_for")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data;
    },
    refetchInterval: 60_000,
  });
}

export function useClinicSettingsFlags(orgId: string) {
  return useQuery({
    queryKey: dashboardKeys.settings(orgId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clinic_settings")
        .select("assistant_enabled, public_chat_enabled, ai_last_test_ok, ai_last_test_at")
        .eq("organization_id", orgId)
        .maybeSingle();
      if (error) throw error;
      // No settings row yet means nothing has been switched on. The raw test fields are kept
      // so "tested" is judged against the current time, not the time of this fetch.
      return {
        assistantEnabled: data?.assistant_enabled === true,
        publicChatEnabled: data?.public_chat_enabled === true,
        lastTestOk: data?.ai_last_test_ok ?? null,
        lastTestAt: data?.ai_last_test_at ?? null,
      };
    },
  });
}

/** Active services + active FAQs: the assistant needs at least one to answer from. */
export function useKnowledgeCount(orgId: string) {
  return useQuery({
    queryKey: dashboardKeys.knowledge(orgId),
    queryFn: async () => {
      const [services, faqs] = await Promise.all([
        supabase
          .from("clinic_services")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId)
          .eq("is_active", true),
        supabase
          .from("approved_faqs")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId)
          .eq("is_active", true),
      ]);
      if (services.error) throw services.error;
      if (faqs.error) throw faqs.error;
      return { services: services.count ?? 0, faqs: faqs.count ?? 0 };
    },
  });
}

interface SystemStatusResponse {
  whatsapp?: { status?: string | null; last_inbound_at?: string | null } | null;
}

export function useSystemStatus(orgId: string) {
  return useQuery({
    queryKey: dashboardKeys.systemStatus(orgId),
    queryFn: () =>
      callFunction<SystemStatusResponse>(
        "system-status",
        { organization_id: orgId },
        {
          timeout: 15_000,
        },
      ),
    staleTime: 60_000,
  });
}
