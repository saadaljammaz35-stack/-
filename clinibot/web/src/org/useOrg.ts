import { use } from "react";
import { OrgContext, type Org, type OrgValue } from "./context";

/** { orgs, current, role, setCurrentOrg, refresh, loading, error } */
export function useOrg(): OrgValue {
  const value = use(OrgContext);
  if (!value) throw new Error("useOrg() must be used inside <OrgProvider>");
  return value;
}

/**
 * The current clinic, for pages under /app (RequireOrg guarantees one):
 *   const org = useCurrentOrg();  // org.id, org.name, org.slug, org.role
 */
export function useCurrentOrg(): Org {
  const { current } = useOrg();
  if (!current) throw new Error("useCurrentOrg() needs a selected clinic (use it under /app)");
  return current;
}
