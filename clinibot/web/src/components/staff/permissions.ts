import type { MemberRole } from "@/org/context";

/**
 * Who may do what on the team page. These mirror the server rules (Edge
 * Function invite-member, rpc update_member_role / remove_member and the
 * keep_an_owner trigger); the server enforces them regardless of the UI.
 */

export const ROLE_ORDER: readonly MemberRole[] = ["owner", "admin", "receptionist"];

/** Roles the caller may give in an invitation. Owners are never invited: ownership is given by changing a role. */
export function invitableRoles(caller: MemberRole | null | undefined): MemberRole[] {
  if (caller === "owner") return ["admin", "receptionist"];
  if (caller === "admin") return ["receptionist"];
  return [];
}

export function canInvite(caller: MemberRole | null | undefined): boolean {
  return invitableRoles(caller).length > 0;
}

/** Only owners change roles (rpc update_member_role). */
export function canChangeRoles(caller: MemberRole | null | undefined): boolean {
  return caller === "owner";
}

export interface TeamMember {
  member_id: string;
  user_id: string;
  role: MemberRole;
}

export function countOwners(members: readonly Pick<TeamMember, "role">[]): number {
  return members.filter((member) => member.role === "owner").length;
}

export type RoleChangeCheck =
  | { allowed: true; self: boolean; options: MemberRole[] }
  | { allowed: false; reason: "owner_only" | "last_owner" };

/**
 * Whether the caller may change `target`'s role, and to what. The last owner
 * can never be demoted (the clinic must keep at least one owner).
 */
export function roleChangePermission(
  caller: { role: MemberRole | null | undefined; userId: string | null | undefined },
  target: TeamMember,
  ownerCount: number,
): RoleChangeCheck {
  if (!canChangeRoles(caller.role)) return { allowed: false, reason: "owner_only" };
  if (target.role === "owner" && ownerCount <= 1) return { allowed: false, reason: "last_owner" };
  return {
    allowed: true,
    self: target.user_id === caller.userId,
    options: ROLE_ORDER.filter((role) => role !== target.role),
  };
}

export type RemovalCheck =
  | { allowed: true; kind: "leave" | "remove" }
  | { allowed: false; reason: "last_owner" | "owner_only" | "no_permission" };

/**
 * Owners remove anyone except the last owner; admins remove receptionists;
 * anyone may leave (unless they are the last owner).
 */
export function removalPermission(
  caller: { role: MemberRole | null | undefined; userId: string | null | undefined },
  target: TeamMember,
  ownerCount: number,
): RemovalCheck {
  const lastOwner = target.role === "owner" && ownerCount <= 1;
  if (target.user_id === caller.userId) {
    return lastOwner ? { allowed: false, reason: "last_owner" } : { allowed: true, kind: "leave" };
  }
  if (caller.role === "owner") {
    return lastOwner ? { allowed: false, reason: "last_owner" } : { allowed: true, kind: "remove" };
  }
  if (caller.role === "admin") {
    return target.role === "receptionist"
      ? { allowed: true, kind: "remove" }
      : { allowed: false, reason: "owner_only" };
  }
  return { allowed: false, reason: "no_permission" };
}

/** Capabilities shown in the "what each role can do" table, in display order. */
export const CAPABILITIES = [
  { key: "conversations", roles: ["owner", "admin", "receptionist"] },
  { key: "knowledgeView", roles: ["owner", "admin", "receptionist"] },
  { key: "knowledgeEdit", roles: ["owner", "admin"] },
  { key: "assistant", roles: ["owner", "admin"] },
  { key: "settings", roles: ["owner", "admin"] },
  { key: "staffReceptionists", roles: ["owner", "admin"] },
  { key: "audit", roles: ["owner", "admin"] },
  { key: "billing", roles: ["owner", "admin"] },
  { key: "staffRoles", roles: ["owner"] },
  { key: "deleteClinic", roles: ["owner"] },
] as const satisfies ReadonlyArray<{ key: string; roles: readonly MemberRole[] }>;

export type CapabilityKey = (typeof CAPABILITIES)[number]["key"];

export function roleCan(role: MemberRole, capability: CapabilityKey): boolean {
  const entry = CAPABILITIES.find((item) => item.key === capability);
  return entry ? (entry.roles as readonly MemberRole[]).includes(role) : false;
}
