import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
import { parseEntitlements, type Entitlements } from "./model";

export const billingKeys = {
  all: (orgId: string) => [...queryKeys.org(orgId), "billing"] as const,
  entitlements: (orgId: string) => [...queryKeys.org(orgId), "billing", "entitlements"] as const,
  subscription: (orgId: string) => [...queryKeys.org(orgId), "billing", "subscription"] as const,
  usage: (orgId: string) => [...queryKeys.org(orgId), "billing", "usage"] as const,
  /** plan_limits is the same for every clinic (public pricing). */
  plans: () => ["plan_limits"] as const,
};

/** rpc org_entitlements: plan, status, AI replies and seats (any member may read it). */
export function useEntitlements(orgId: string) {
  return useQuery({
    queryKey: billingKeys.entitlements(orgId),
    queryFn: async (): Promise<Entitlements> => {
      const { data, error } = await supabase.rpc("org_entitlements", { p_org: orgId });
      if (error) throw error;
      return parseEntitlements(data);
    },
  });
}

/** The clinic's most recent subscription record (owners and admins only, by RLS). */
export function useLatestSubscription(orgId: string, enabled = true) {
  return useQuery({
    queryKey: billingKeys.subscription(orgId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_records")
        .select("id, plan, status, trial_ends_at, current_period_start, current_period_end, created_at")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled,
  });
}

export function usePlans(enabled = true) {
  return useQuery({
    queryKey: billingKeys.plans(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plan_limits")
        .select("plan, name_ar, name_en, monthly_price_sar, ai_replies_per_month, seats, sort_order")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data;
    },
    staleTime: 60 * 60_000,
    enabled,
  });
}

export const USAGE_MONTHS = 12;

/** ai_usage_monthly for the last 12 months, newest first. */
export function useUsageHistory(orgId: string, enabled = true) {
  return useQuery({
    queryKey: billingKeys.usage(orgId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_usage_monthly")
        .select("month, replies, test_replies, input_tokens, output_tokens")
        .eq("organization_id", orgId)
        .order("month", { ascending: false })
        .limit(USAGE_MONTHS);
      if (error) throw error;
      return data;
    },
    enabled,
  });
}
