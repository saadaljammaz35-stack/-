import type { BadgeTone } from "@/components/ui";
import type { MessageKey } from "@/i18n";
import type { MemberRole } from "@/org/context";

/** One-line description of each role, shown where a role is chosen. */
export const ROLE_HINTS: Record<MemberRole, MessageKey> = {
  owner: "staff.roleOwnerHint",
  admin: "staff.roleAdminHint",
  receptionist: "staff.roleReceptionistHint",
};

export const ROLE_TONES: Record<MemberRole, BadgeTone> = {
  owner: "brand",
  admin: "info",
  receptionist: "neutral",
};
