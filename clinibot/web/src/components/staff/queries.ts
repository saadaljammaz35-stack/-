import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { billingKeys } from "@/components/billing/queries";
import { callFunction } from "@/lib/api";
import { queryKeys } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
import type { MemberRole } from "@/org/context";

export interface Member {
  member_id: string;
  user_id: string;
  role: MemberRole;
  email: string;
  /** From the account's profile; may be missing. */
  full_name: string | null;
  created_at: string;
}

export const staffKeys = {
  members: (orgId: string) => [...queryKeys.org(orgId), "staff", "members"] as const,
  /** Other sections cache the member list (assignee pickers) under this key. */
  sharedMembers: (orgId: string) => [...queryKeys.org(orgId), "members"] as const,
};

/** The name to show for a member: their full name, else their email. */
export function displayName(member: Pick<Member, "full_name" | "email">): string {
  return member.full_name?.trim() || member.email;
}

/** rpc list_org_members: everyone in the clinic, oldest first. */
export function useTeamMembers(orgId: string) {
  return useQuery({
    queryKey: staffKeys.members(orgId),
    queryFn: async (): Promise<Member[]> => {
      const { data, error } = await supabase.rpc("list_org_members", { p_org: orgId });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        member_id: row.member_id,
        user_id: row.user_id,
        role: row.role,
        email: row.email,
        full_name: (row.full_name as string | null) ?? null,
        created_at: row.created_at,
      }));
    },
  });
}

/** Refreshes everything that depends on who is in the team. */
export function useInvalidateTeam(orgId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: staffKeys.members(orgId) }),
      queryClient.invalidateQueries({ queryKey: staffKeys.sharedMembers(orgId) }),
      queryClient.invalidateQueries({ queryKey: billingKeys.entitlements(orgId) }),
    ]);
}

export interface InviteInput {
  email: string;
  role: Exclude<MemberRole, "owner">;
  fullName: string;
}

export interface InviteResult {
  member_id: string;
  /** true: a new account was emailed an invitation; false: an existing account was added. */
  invited: boolean;
}

export function useInviteMember(orgId: string) {
  const invalidate = useInvalidateTeam(orgId);
  return useMutation({
    mutationFn: (input: InviteInput) =>
      callFunction<InviteResult>("invite-member", {
        organization_id: orgId,
        email: input.email,
        role: input.role,
        ...(input.fullName ? { full_name: input.fullName } : {}),
      }),
    onSuccess: () => invalidate(),
    meta: { silentError: true },
  });
}

export function useUpdateMemberRole(orgId: string) {
  const invalidate = useInvalidateTeam(orgId);
  return useMutation({
    mutationFn: async (input: { memberId: string; role: MemberRole }) => {
      const { error } = await supabase.rpc("update_member_role", {
        p_member_id: input.memberId,
        p_role: input.role,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
    meta: { silentError: true },
  });
}

export function useRemoveMember(orgId: string) {
  const invalidate = useInvalidateTeam(orgId);
  return useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase.rpc("remove_member", { p_member_id: memberId });
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
    meta: { silentError: true },
  });
}
