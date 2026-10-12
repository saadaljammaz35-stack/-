import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/auth/useAuth";
import { queryKeys } from "@/lib/queryClient";
import { safeStorage, STORAGE_KEYS } from "@/lib/storage";
import { supabase } from "@/lib/supabase";
import { OrgContext, type Org, type OrgValue } from "./context";

async function fetchMemberships(userId: string): Promise<Org[]> {
  // RLS lets members see every member of their clinics, so filter to this user.
  const { data, error } = await supabase
    .from("organization_members")
    .select("role, organization:organizations(id, name, slug, default_language)")
    .eq("user_id", userId);
  if (error) throw error;
  const orgs: Org[] = [];
  for (const row of data) {
    const organization = row.organization;
    if (!organization) continue;
    orgs.push({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      defaultLanguage: organization.default_language === "en" ? "en" : "ar",
      role: row.role,
    });
  }
  return orgs.sort((a, b) => a.name.localeCompare(b.name));
}

export function OrgProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    safeStorage.get(STORAGE_KEYS.currentOrg),
  );

  const query = useQuery({
    queryKey: queryKeys.memberships(userId ?? "anonymous"),
    queryFn: () => fetchMemberships(userId!),
    enabled: userId !== null,
    staleTime: 5 * 60_000,
  });

  const orgs = useMemo(() => query.data ?? [], [query.data]);
  const current = useMemo(
    () => orgs.find((org) => org.id === selectedId) ?? orgs[0] ?? null,
    [orgs, selectedId],
  );

  const setCurrentOrg = useCallback((orgId: string) => {
    safeStorage.set(STORAGE_KEYS.currentOrg, orgId);
    setSelectedId(orgId);
  }, []);

  const { refetch } = query;
  const refresh = useCallback(async () => {
    const result = await refetch({ throwOnError: true });
    return result.data ?? [];
  }, [refetch]);

  const value = useMemo<OrgValue>(
    () => ({
      orgs,
      current,
      role: current?.role ?? null,
      setCurrentOrg,
      refresh,
      loading: userId !== null && query.isPending,
      error: query.error,
    }),
    [orgs, current, setCurrentOrg, refresh, userId, query.isPending, query.error],
  );

  return <OrgContext value={value}>{children}</OrgContext>;
}
