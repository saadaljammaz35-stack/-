import { useInfiniteQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
import { actionsInCategory, type AuditCategory } from "./actions";

export const AUDIT_PAGE_SIZE = 50;

export const auditKeys = {
  list: (orgId: string, category: AuditCategory | "all") =>
    [...queryKeys.org(orgId), "audit", category] as const,
};

const AUDIT_COLUMNS = "id, created_at, actor_type, actor_user_id, action, entity_type, details";

/**
 * audit_logs for one clinic, newest first, 50 at a time. Pages continue from
 * the last id seen (ids only grow), so entries written meanwhile never shift
 * or repeat what is already on screen.
 */
export function useAuditLog(orgId: string, category: AuditCategory | "all", enabled = true) {
  return useInfiniteQuery({
    queryKey: auditKeys.list(orgId, category),
    initialPageParam: null as number | null,
    queryFn: async ({ pageParam }) => {
      let query = supabase.from("audit_logs").select(AUDIT_COLUMNS).eq("organization_id", orgId);
      if (category !== "all") query = query.in("action", actionsInCategory(category));
      if (pageParam !== null) query = query.lt("id", pageParam);
      // One extra row tells whether another page exists.
      const { data, error } = await query
        .order("id", { ascending: false })
        .limit(AUDIT_PAGE_SIZE + 1);
      if (error) throw error;
      return {
        entries: data.slice(0, AUDIT_PAGE_SIZE),
        hasMore: data.length > AUDIT_PAGE_SIZE,
      };
    },
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? (lastPage.entries[lastPage.entries.length - 1]?.id ?? null) : null,
    enabled,
  });
}
