import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { callFunction } from "@/lib/api";
import type { TablesUpdate } from "@/lib/database.types";
import { queryKeys } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
import { ensureAffected, keepWithinOrg } from "@/components/dashboard/db";
import { escapeLike } from "@/components/conversations/model";
import {
  DETAIL_COLUMNS,
  LIST_COLUMNS,
  parseAppointmentSearch,
  type AppointmentDetailRow,
  type AppointmentListRow,
  type AppointmentStatus,
  type ListTab,
  type TimeWindow,
} from "./model";

export const LIST_LIMIT = 100;
/** The list and the open request refresh every 15 seconds while the tab is visible. */
export const POLL_MS = 15_000;

export interface AppointmentFilters {
  status: ListTab;
  search: string;
}

export const appointmentKeys = {
  all: (orgId: string) => [...queryKeys.org(orgId), "appointments"] as const,
  list: (orgId: string, filters: AppointmentFilters) =>
    [...queryKeys.org(orgId), "appointments", "list", filters] as const,
  detail: (orgId: string, id: string) =>
    [...queryKeys.org(orgId), "appointments", "detail", id] as const,
  notes: (orgId: string, id: string) =>
    [...queryKeys.org(orgId), "appointments", "notes", id] as const,
  services: (orgId: string) => [...queryKeys.org(orgId), "appointments", "services"] as const,
};

/**
 * Thrown when an update matched no row because the request changed meanwhile
 * (another member moved it on) or is gone.
 */
export class AppointmentChangedError extends Error {
  constructor() {
    super("The appointment request changed or no longer exists");
    this.name = "AppointmentChangedError";
  }
}

export function useAppointmentList(
  orgId: string,
  filters: AppointmentFilters,
  refetchInterval: number | false,
) {
  return useQuery({
    queryKey: appointmentKeys.list(orgId, filters),
    queryFn: async (): Promise<AppointmentListRow[]> => {
      let query = supabase
        .from("appointment_requests")
        .select(LIST_COLUMNS)
        .eq("organization_id", orgId);
      if (filters.status !== "all") query = query.eq("status", filters.status);
      const search = parseAppointmentSearch(filters.search);
      if (search?.kind === "name") {
        query = query.ilike("customer_name", `%${escapeLike(search.value)}%`);
      } else if (search?.kind === "phone") {
        query = query.like("customer_phone", `%${search.value}%`);
      }
      const { data, error } = await query
        .order("created_at", { ascending: false })
        .limit(LIST_LIMIT);
      if (error) throw error;
      return data;
    },
    refetchInterval,
    placeholderData: keepWithinOrg(orgId),
  });
}

export function useAppointment(orgId: string, id: string, refetchInterval: number | false) {
  return useQuery({
    queryKey: appointmentKeys.detail(orgId, id),
    queryFn: async (): Promise<AppointmentDetailRow | null> => {
      const { data, error } = await supabase
        .from("appointment_requests")
        .select(DETAIL_COLUMNS)
        .eq("id", id)
        .eq("organization_id", orgId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    refetchInterval,
  });
}

export function useNotes(orgId: string, id: string) {
  return useQuery({
    queryKey: appointmentKeys.notes(orgId, id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointment_request_notes")
        .select("id, body, author_id, created_at")
        .eq("appointment_request_id", id)
        .eq("organization_id", orgId)
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });
}

/** Active services of this clinic, for the "new request" form. */
export function useActiveServices(orgId: string) {
  return useQuery({
    queryKey: appointmentKeys.services(orgId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clinic_services")
        .select("id, name_ar, name_en")
        .eq("organization_id", orgId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60_000,
  });
}

function useInvalidateAppointments(orgId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: appointmentKeys.all(orgId) }),
      queryClient.invalidateQueries({ queryKey: [...queryKeys.org(orgId), "dashboard"] }),
    ]);
}

export type AppointmentPatch = Pick<
  TablesUpdate<"appointment_requests">,
  "status" | "scheduled_for" | "assigned_to"
>;

/**
 * Updates a request. `expectStatus` makes the update conditional on the status
 * the user saw, so two people cannot move the same request at once; the
 * database trigger enforces the allowed transitions regardless.
 */
export function useUpdateAppointment(orgId: string, id: string) {
  const invalidate = useInvalidateAppointments(orgId);
  return useMutation({
    mutationFn: async ({
      patch,
      expectStatus,
    }: {
      patch: AppointmentPatch;
      expectStatus?: AppointmentStatus;
    }) => {
      let query = supabase
        .from("appointment_requests")
        .update(patch)
        .eq("id", id)
        .eq("organization_id", orgId);
      if (expectStatus) query = query.eq("status", expectStatus);
      const { data, error } = await query.select("id");
      if (error) throw error;
      if (!data || data.length === 0) throw new AppointmentChangedError();
    },
    onSettled: invalidate,
    meta: { silentError: true },
  });
}

export function useAddNote(orgId: string, appointmentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) => {
      const { error } = await supabase.from("appointment_request_notes").insert({
        organization_id: orgId,
        appointment_request_id: appointmentId,
        body,
      });
      if (error) throw error;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: appointmentKeys.notes(orgId, appointmentId) }),
    meta: { silentError: true },
  });
}

/** Owner/admin only (RLS). Notes go with it (cascade). */
export function useDeleteAppointment(orgId: string, id: string) {
  const invalidate = useInvalidateAppointments(orgId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("appointment_requests")
        .delete()
        .eq("id", id)
        .eq("organization_id", orgId)
        .select("id");
      if (error) throw error;
      ensureAffected(data);
    },
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: appointmentKeys.detail(orgId, id) });
      await invalidate();
    },
    meta: { silentError: true },
  });
}

export interface NewAppointment {
  customer_name: string;
  customer_phone: string;
  service_id: string | null;
  preferred_date: string | null;
  preferred_time_window: TimeWindow;
  customer_notes: string | null;
}

/** A request taken by phone or at the desk. `source` is "dashboard" by default (and by policy). */
export function useCreateAppointment(orgId: string) {
  const invalidate = useInvalidateAppointments(orgId);
  return useMutation({
    mutationFn: async (input: NewAppointment) => {
      const { data, error } = await supabase
        .from("appointment_requests")
        .insert({ organization_id: orgId, ...input })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: invalidate,
    meta: { silentError: true },
  });
}

export interface NotifyResult {
  notified_at: string | null;
  channel: "web" | "whatsapp";
  message: { id: string; status: string; error_code: string | null };
}

export function useNotifyCustomer(orgId: string, id: string) {
  const invalidate = useInvalidateAppointments(orgId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      callFunction<NotifyResult>(
        "appointment-notify",
        { appointment_request_id: id },
        { timeout: 30_000 },
      ),
    onSettled: () =>
      Promise.all([
        invalidate(),
        queryClient.invalidateQueries({ queryKey: [...queryKeys.org(orgId), "conversations"] }),
      ]),
    meta: { silentError: true },
  });
}
