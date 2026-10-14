import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
import {
  FAQ_COLUMNS,
  SERVICE_COLUMNS,
  nextSortOrder,
  parseWorkingHours,
  toServiceRow,
  type FaqPayload,
  type FaqRow,
  type ServicePayload,
  type ServiceRow,
  type WorkingHours,
} from "./model";

export const knowledgeKeys = {
  all: (orgId: string) => [...queryKeys.org(orgId), "knowledge"] as const,
  services: (orgId: string) => [...queryKeys.org(orgId), "knowledge", "services"] as const,
  faqs: (orgId: string) => [...queryKeys.org(orgId), "knowledge", "faqs"] as const,
  clinicInfo: (orgId: string) => [...queryKeys.org(orgId), "knowledge", "clinic-info"] as const,
};

/** Upper bound matching what the assistant loads (200 of each). */
const LIST_LIMIT = 200;

/**
 * RLS turns "not allowed" or "already deleted" into a write that matches no
 * row, without an error. Report it like PostgREST's "no rows" (shown as
 * "not found") instead of pretending it worked.
 */
export function ensureAffected<T>(data: T[] | null): T[] {
  if (!data || data.length === 0) {
    throw Object.assign(new Error("No row was changed"), {
      code: "PGRST116",
      details: null,
      hint: null,
    });
  }
  return data;
}

export function useServices(orgId: string) {
  return useQuery({
    queryKey: knowledgeKeys.services(orgId),
    queryFn: async (): Promise<ServiceRow[]> => {
      const { data, error } = await supabase
        .from("clinic_services")
        .select(SERVICE_COLUMNS)
        .eq("organization_id", orgId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true })
        .limit(LIST_LIMIT);
      if (error) throw error;
      return data.map(toServiceRow);
    },
  });
}

export function useFaqs(orgId: string) {
  return useQuery({
    queryKey: knowledgeKeys.faqs(orgId),
    queryFn: async (): Promise<FaqRow[]> => {
      const { data, error } = await supabase
        .from("approved_faqs")
        .select(FAQ_COLUMNS)
        .eq("organization_id", orgId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true })
        .limit(LIST_LIMIT);
      if (error) throw error;
      return data;
    },
  });
}

export interface ClinicInfo {
  workingHours: WorkingHours;
  hoursNoteAr: string | null;
  hoursNoteEn: string | null;
  timezone: string;
  receptionPhone: string | null;
  emergencyNumber: string;
}

/** The parts of clinic_settings the preview shows (hours, phones). */
export function useClinicInfo(orgId: string) {
  return useQuery({
    queryKey: knowledgeKeys.clinicInfo(orgId),
    queryFn: async (): Promise<ClinicInfo | null> => {
      const { data, error } = await supabase
        .from("clinic_settings")
        .select(
          "working_hours, working_hours_note_ar, working_hours_note_en, timezone, reception_phone, emergency_number",
        )
        .eq("organization_id", orgId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        workingHours: parseWorkingHours(data.working_hours),
        hoursNoteAr: data.working_hours_note_ar,
        hoursNoteEn: data.working_hours_note_en,
        timezone: data.timezone,
        receptionPhone: data.reception_phone,
        emergencyNumber: data.emergency_number,
      };
    },
    staleTime: 60_000,
  });
}

/** Refreshes this page plus other screens that show services or knowledge counts. */
function useInvalidateKnowledge(orgId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: knowledgeKeys.all(orgId) }),
      queryClient.invalidateQueries({ queryKey: [...queryKeys.org(orgId), "dashboard"] }),
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.org(orgId), "appointments", "services"],
      }),
    ]);
}

type Table = "clinic_services" | "approved_faqs";

/** Only columns the browser is granted UPDATE on (organization_id is never sent). */
type ServicePatch = Partial<ServicePayload> & { sort_order?: number };
type FaqPatch = Partial<FaqPayload> & { sort_order?: number };
type Patch<T extends Table> = T extends "clinic_services" ? ServicePatch : FaqPatch;

async function updateRow<T extends Table>(
  table: T,
  orgId: string,
  id: string,
  patch: Patch<T>,
): Promise<void> {
  const { data, error } =
    table === "clinic_services"
      ? await supabase
          .from("clinic_services")
          .update(patch as ServicePatch)
          .eq("id", id)
          .eq("organization_id", orgId)
          .select("id")
      : await supabase
          .from("approved_faqs")
          .update(patch as FaqPatch)
          .eq("id", id)
          .eq("organization_id", orgId)
          .select("id");
  if (error) throw error;
  ensureAffected(data);
}

async function deleteRow(table: Table, orgId: string, id: string): Promise<void> {
  const { data, error } = await supabase
    .from(table)
    .delete()
    .eq("id", id)
    .eq("organization_id", orgId)
    .select("id");
  if (error) throw error;
  ensureAffected(data);
}

/** Writes new positions one row at a time (each is filtered by clinic as well as id). */
async function writeOrder(
  table: Table,
  orgId: string,
  updates: ReadonlyArray<{ id: string; sort_order: number }>,
): Promise<void> {
  for (const update of updates) {
    await updateRow(table, orgId, update.id, { sort_order: update.sort_order });
  }
}

// ─────────────────────────────── services ───────────────────────────────

export function useSaveService(orgId: string) {
  const invalidate = useInvalidateKnowledge(orgId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string | null; payload: ServicePayload }) => {
      if (id) {
        await updateRow("clinic_services", orgId, id, payload);
        return id;
      }
      const existing = queryClient.getQueryData<ServiceRow[]>(knowledgeKeys.services(orgId)) ?? [];
      const { data, error } = await supabase
        .from("clinic_services")
        .insert({ ...payload, organization_id: orgId, sort_order: nextSortOrder(existing) })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: invalidate,
    meta: { silentError: true },
  });
}

export function useSetServiceActive(orgId: string) {
  const invalidate = useInvalidateKnowledge(orgId);
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      updateRow("clinic_services", orgId, id, { is_active: active }),
    onSettled: invalidate,
  });
}

export function useDeleteService(orgId: string) {
  const invalidate = useInvalidateKnowledge(orgId);
  return useMutation({
    mutationFn: (id: string) => deleteRow("clinic_services", orgId, id),
    onSuccess: invalidate,
    meta: { silentError: true },
  });
}

export function useReorderServices(orgId: string) {
  const invalidate = useInvalidateKnowledge(orgId);
  return useMutation({
    mutationFn: (updates: ReadonlyArray<{ id: string; sort_order: number }>) =>
      writeOrder("clinic_services", orgId, updates),
    onSettled: invalidate,
  });
}

// ─────────────────────────────── FAQs ───────────────────────────────

export function useSaveFaq(orgId: string) {
  const invalidate = useInvalidateKnowledge(orgId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string | null; payload: FaqPayload }) => {
      if (id) {
        await updateRow("approved_faqs", orgId, id, payload);
        return id;
      }
      const existing = queryClient.getQueryData<FaqRow[]>(knowledgeKeys.faqs(orgId)) ?? [];
      const { data, error } = await supabase
        .from("approved_faqs")
        .insert({ ...payload, organization_id: orgId, sort_order: nextSortOrder(existing) })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: invalidate,
    meta: { silentError: true },
  });
}

export function useSetFaqActive(orgId: string) {
  const invalidate = useInvalidateKnowledge(orgId);
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      updateRow("approved_faqs", orgId, id, { is_active: active }),
    onSettled: invalidate,
  });
}

export function useDeleteFaq(orgId: string) {
  const invalidate = useInvalidateKnowledge(orgId);
  return useMutation({
    mutationFn: (id: string) => deleteRow("approved_faqs", orgId, id),
    onSuccess: invalidate,
    meta: { silentError: true },
  });
}

export function useReorderFaqs(orgId: string) {
  const invalidate = useInvalidateKnowledge(orgId);
  return useMutation({
    mutationFn: (updates: ReadonlyArray<{ id: string; sort_order: number }>) =>
      writeOrder("approved_faqs", orgId, updates),
    onSettled: invalidate,
  });
}
