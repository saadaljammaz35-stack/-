import { useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { queryKeys } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
import { useOrg } from "@/org/useOrg";

/**
 * After the signed-in user lost access to a clinic (left it or deleted it):
 * reload their memberships, switch to another clinic (or onboarding when none
 * is left) and drop everything cached for the old one.
 */
export function useExitClinic() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { refresh, setCurrentOrg } = useOrg();

  return useCallback(
    async (orgId: string) => {
      let remaining;
      try {
        remaining = await refresh();
      } catch {
        // The action itself succeeded; start the app afresh so nothing stale is shown.
        window.location.assign("/app");
        return;
      }
      const next = remaining.find((org) => org.id !== orgId);
      if (next) {
        setCurrentOrg(next.id);
        void navigate("/app", { replace: true });
      } else {
        void navigate("/onboarding", { replace: true });
      }
      queryClient.removeQueries({ queryKey: queryKeys.org(orgId) });
    },
    [navigate, queryClient, refresh, setCurrentOrg],
  );
}

/** rpc remove_member on your own membership. No cache refresh here: useExitClinic follows. */
export function useLeaveClinic() {
  return useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase.rpc("remove_member", { p_member_id: memberId });
      if (error) throw error;
    },
    meta: { silentError: true },
  });
}
