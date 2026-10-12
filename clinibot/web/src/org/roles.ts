import type { MessageKey } from "@/i18n";
import type { MemberRole } from "./context";

/** Owners and admins manage clinic settings, staff, WhatsApp and the audit log. */
export const MANAGER_ROLES: readonly MemberRole[] = ["owner", "admin"];

export function hasRole(
  role: MemberRole | null | undefined,
  allowed: readonly MemberRole[],
): boolean {
  return role != null && allowed.includes(role);
}

export function canManage(role: MemberRole | null | undefined): boolean {
  return hasRole(role, MANAGER_ROLES);
}

export const ROLE_LABELS: Record<MemberRole, MessageKey> = {
  owner: "common.roleOwner",
  admin: "common.roleAdmin",
  receptionist: "common.roleReceptionist",
};
