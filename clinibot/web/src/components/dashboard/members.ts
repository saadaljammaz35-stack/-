import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";

export type OrgMember = Database["public"]["Functions"]["list_org_members"]["Returns"][number];

export function membersKey(orgId: string) {
  return [...queryKeys.org(orgId), "members"] as const;
}

/** Everyone in the clinic (rpc list_org_members), for assignee pickers and note authors. */
export function useOrgMembers(orgId: string) {
  return useQuery({
    queryKey: membersKey(orgId),
    queryFn: async (): Promise<OrgMember[]> => {
      const { data, error } = await supabase.rpc("list_org_members", { p_org: orgId });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60_000,
  });
}

/** The name to show for a member: their full name, else their email. */
export function memberName(member: Pick<OrgMember, "full_name" | "email">): string {
  return member.full_name?.trim() || member.email;
}

/**
 * user_id → display name, for rows that store only the user id. Null while the
 * team list is loading or failed to load: then nobody's name is known yet.
 */
export function memberNameMap(
  members: readonly OrgMember[] | undefined,
): Map<string, string> | null {
  return members ? new Map(members.map((member) => [member.user_id, memberName(member)])) : null;
}

export type MemberLabel = { kind: "name"; name: string } | { kind: "former" } | { kind: "unknown" };

/**
 * Who a stored user id is: a current member (by name), a former member (not in
 * the loaded team), or unknown while the team list is unavailable. A list that
 * did not load never turns colleagues into former members.
 */
export function memberLabel(
  names: ReadonlyMap<string, string> | null,
  userId: string,
): MemberLabel {
  if (!names) return { kind: "unknown" };
  const name = names.get(userId);
  return name === undefined ? { kind: "former" } : { kind: "name", name };
}
