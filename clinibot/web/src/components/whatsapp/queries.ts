import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { callFunction } from "@/lib/api";
import { queryKeys } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
import { assistantKeys } from "@/components/assistant/queries";
import { ensureAffected } from "@/components/knowledge/queries";
import type { CredentialsValues, TemplatePayload } from "./model";

export const whatsappKeys = {
  integration: (orgId: string) => [...queryKeys.org(orgId), "whatsapp", "integration"] as const,
};

/** Shown once: the response of `save` and `rotate_verify_token`. */
export interface RevealedSecret {
  webhookUrl: string;
  verifyToken: string;
  /** Only from `save`: whether CliniBot subscribed the app to the WABA. */
  appSubscribed: boolean | null;
}

export interface ConnectionTestResult {
  displayPhoneNumber: string | null;
  verifiedName: string | null;
  qualityRating: string | null;
}

export interface IntegrationRow {
  id: string;
  confirmationTemplateName: string | null;
  confirmationTemplateLanguage: string;
}

/** integration_settings is readable by owners/admins only; the row exists once credentials were saved. */
export function useIntegration(orgId: string, enabled: boolean) {
  return useQuery({
    queryKey: whatsappKeys.integration(orgId),
    queryFn: async (): Promise<IntegrationRow | null> => {
      const { data, error } = await supabase
        .from("integration_settings")
        .select("id, confirmation_template_name, confirmation_template_language")
        .eq("organization_id", orgId)
        .eq("provider", "whatsapp")
        .maybeSingle();
      if (error) throw error;
      return data
        ? {
            id: data.id,
            confirmationTemplateName: data.confirmation_template_name,
            confirmationTemplateLanguage: data.confirmation_template_language,
          }
        : null;
    },
    enabled,
  });
}

function useInvalidateWhatsApp(orgId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: assistantKeys.systemStatus(orgId) }),
      queryClient.invalidateQueries({ queryKey: whatsappKeys.integration(orgId) }),
      queryClient.invalidateQueries({ queryKey: [...queryKeys.org(orgId), "dashboard"] }),
    ]);
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}
const text = (value: unknown): string | null => (typeof value === "string" ? value : null);

function toRevealed(raw: unknown): RevealedSecret {
  const body = asRecord(raw);
  return {
    webhookUrl: text(body.webhook_url) ?? "",
    verifyToken: text(body.verify_token) ?? "",
    appSubscribed: typeof body.app_subscribed === "boolean" ? body.app_subscribed : null,
  };
}

export function useSaveCredentials(orgId: string) {
  const invalidate = useInvalidateWhatsApp(orgId);
  return useMutation({
    mutationFn: async (credentials: CredentialsValues) =>
      toRevealed(
        await callFunction<unknown>(
          "whatsapp-connect",
          { action: "save", organization_id: orgId, ...credentials },
          { timeout: 45_000 },
        ),
      ),
    onSettled: invalidate,
    meta: { silentError: true },
  });
}

export function useRotateVerifyToken(orgId: string) {
  const invalidate = useInvalidateWhatsApp(orgId);
  return useMutation({
    mutationFn: async () =>
      toRevealed(
        await callFunction<unknown>(
          "whatsapp-connect",
          { action: "rotate_verify_token", organization_id: orgId },
          { timeout: 30_000 },
        ),
      ),
    onSettled: invalidate,
    meta: { silentError: true },
  });
}

export function useTestConnection(orgId: string) {
  const invalidate = useInvalidateWhatsApp(orgId);
  return useMutation({
    mutationFn: async (): Promise<ConnectionTestResult> => {
      const body = asRecord(
        await callFunction<unknown>(
          "whatsapp-connect",
          { action: "test", organization_id: orgId },
          { timeout: 45_000 },
        ),
      );
      return {
        displayPhoneNumber: text(body.display_phone_number),
        verifiedName: text(body.verified_name),
        qualityRating: text(body.quality_rating),
      };
    },
    // A failed test also changes the stored status (to "error"), so refresh either way.
    onSettled: invalidate,
    meta: { silentError: true },
  });
}

export function useDisconnect(orgId: string) {
  const invalidate = useInvalidateWhatsApp(orgId);
  return useMutation({
    mutationFn: () =>
      callFunction<unknown>(
        "whatsapp-connect",
        { action: "disconnect", organization_id: orgId },
        { timeout: 30_000 },
      ),
    onSettled: invalidate,
    meta: { silentError: true },
  });
}

export function useSaveTemplate(orgId: string) {
  const invalidate = useInvalidateWhatsApp(orgId);
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: TemplatePayload }) => {
      const { data, error } = await supabase
        .from("integration_settings")
        .update(payload)
        .eq("id", id)
        .eq("organization_id", orgId)
        .select("id");
      if (error) throw error;
      ensureAffected(data);
    },
    onSuccess: invalidate,
    meta: { silentError: true, successMessage: "whatsapp.templateSaved" },
  });
}
