import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TablesUpdate } from "@/lib/database.types";
import { queryKeys } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";

export const settingsKeys = {
  profile: (orgId: string) => [...queryKeys.org(orgId), "settings", "profile"] as const,
  clinic: (orgId: string) => [...queryKeys.org(orgId), "settings", "clinic"] as const,
};

/**
 * Row-level security turns "not allowed" into an update that matches nothing,
 * without an error. Report it as PostgREST's "no rows" (shown as not found)
 * instead of pretending the save worked.
 */
export function ensureUpdated<T>(data: T[] | null): T[] {
  if (!data || data.length === 0) {
    throw Object.assign(new Error("No row was changed"), {
      code: "PGRST116",
      details: null,
      hint: null,
    });
  }
  return data;
}

export function useOrganizationProfile(orgId: string) {
  return useQuery({
    queryKey: settingsKeys.profile(orgId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name, slug, city, phone, default_language")
        .eq("id", orgId)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

/** Columns this page reads from clinic_settings. */
const CLINIC_COLUMNS =
  "organization_id, display_name_ar, display_name_en, address_ar, address_en, maps_url, reception_phone, working_hours, working_hours_note_ar, working_hours_note_en, privacy_notice_ar, privacy_notice_en, message_retention_days, appointment_retention_days, public_chat_enabled";

export function useClinicSettings(orgId: string) {
  return useQuery({
    queryKey: settingsKeys.clinic(orgId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clinic_settings")
        .select(CLINIC_COLUMNS)
        .eq("organization_id", orgId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export type ClinicSettings = NonNullable<ReturnType<typeof useClinicSettings>["data"]>;

/** Only the columns the browser is granted (see the security migration). */
export type OrganizationPatch = Pick<
  TablesUpdate<"organizations">,
  "name" | "city" | "phone" | "default_language"
>;

export type ClinicSettingsPatch = Pick<
  TablesUpdate<"clinic_settings">,
  | "display_name_ar"
  | "display_name_en"
  | "address_ar"
  | "address_en"
  | "maps_url"
  | "reception_phone"
  | "working_hours"
  | "working_hours_note_ar"
  | "working_hours_note_en"
  | "privacy_notice_ar"
  | "privacy_notice_en"
  | "message_retention_days"
  | "appointment_retention_days"
>;

export function useUpdateOrganization(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patch: OrganizationPatch) => {
      const { data, error } = await supabase
        .from("organizations")
        .update(patch)
        .eq("id", orgId)
        .select("id");
      if (error) throw error;
      ensureUpdated(data);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: settingsKeys.profile(orgId) }),
    meta: { silentError: true, successMessage: "settings.saved" },
  });
}

export function useUpdateClinicSettings(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patch: ClinicSettingsPatch) => {
      const { data, error } = await supabase
        .from("clinic_settings")
        .update(patch)
        .eq("organization_id", orgId)
        .select("organization_id");
      if (error) throw error;
      ensureUpdated(data);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: settingsKeys.clinic(orgId) }),
    meta: { silentError: true, successMessage: "settings.saved" },
  });
}

/** rpc delete_organization: owner only, with the clinic link typed as confirmation. */
export function useDeleteOrganization(orgId: string) {
  return useMutation({
    mutationFn: async (confirmSlug: string) => {
      const { error } = await supabase.rpc("delete_organization", {
        p_org: orgId,
        p_confirm_slug: confirmSlug,
      });
      if (error) throw error;
    },
    meta: { silentError: true },
  });
}
