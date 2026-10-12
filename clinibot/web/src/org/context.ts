import { createContext } from "react";
import type { Enums } from "@/lib/database.types";

export type MemberRole = Enums<"member_role">;

export interface Org {
  id: string;
  name: string;
  slug: string;
  defaultLanguage: "ar" | "en";
  /** The signed-in user's role in this clinic. */
  role: MemberRole;
}

export interface OrgValue {
  /** Every clinic the signed-in user belongs to. */
  orgs: Org[];
  /** The clinic being worked on (remembered per browser), or null if none. */
  current: Org | null;
  /** The user's role in `current`. */
  role: MemberRole | null;
  setCurrentOrg: (orgId: string) => void;
  /** Reloads memberships (after creating a clinic, accepting an invite, …). */
  refresh: () => Promise<Org[]>;
  /** True while memberships load for a signed-in user. */
  loading: boolean;
  error: unknown;
}

export const OrgContext = createContext<OrgValue | null>(null);
