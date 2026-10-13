import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { callFunction } from "@/lib/api";
import type { TablesUpdate } from "@/lib/database.types";
import { queryKeys } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
import { ensureAffected, keepWithinOrg } from "@/components/dashboard/db";
import {
  CONVERSATION_COLUMNS,
  escapeLike,
  MESSAGE_COLUMNS,
  parseConversationSearch,
  type ChannelFilter,
  type ConversationRow,
  type ConversationTab,
  type MessageRow,
  type MessageStatus,
} from "./model";

export interface ListFilters {
  tab: ConversationTab;
  channel: ChannelFilter;
  search: string;
}

/** The list shows the most recent conversations matching the filters. */
export const LIST_LIMIT = 100;
/** The thread shows the latest messages. */
export const MESSAGE_LIMIT = 300;
/** Inbox and thread refresh every 10 seconds while the tab is visible. */
export const POLL_MS = 10_000;

export const conversationKeys = {
  all: (orgId: string) => [...queryKeys.org(orgId), "conversations"] as const,
  list: (orgId: string, filters: ListFilters) =>
    [...queryKeys.org(orgId), "conversations", "list", filters] as const,
  detail: (orgId: string, id: string) =>
    [...queryKeys.org(orgId), "conversations", "detail", id] as const,
  messages: (orgId: string, id: string) =>
    [...queryKeys.org(orgId), "conversations", "messages", id] as const,
};

export function useConversationList(
  orgId: string,
  filters: ListFilters,
  refetchInterval: number | false,
) {
  return useQuery({
    queryKey: conversationKeys.list(orgId, filters),
    queryFn: async (): Promise<ConversationRow[]> => {
      let query = supabase
        .from("conversations")
        .select(CONVERSATION_COLUMNS)
        .eq("organization_id", orgId);
      switch (filters.tab) {
        case "needs_reply":
          // Same rule as needsReply() and dashboard_metrics' "unanswered".
          query = query
            .neq("status", "closed")
            .or("status.eq.awaiting_human,last_message_direction.eq.inbound");
          break;
        case "awaiting":
          query = query.eq("status", "awaiting_human");
          break;
        case "open":
          query = query.eq("status", "open");
          break;
        case "closed":
          query = query.eq("status", "closed");
          break;
        case "all":
          break;
      }
      if (filters.channel !== "all") query = query.eq("channel", filters.channel);
      const search = parseConversationSearch(filters.search);
      if (search?.kind === "name") {
        query = query.ilike("customer_name", `%${escapeLike(search.value)}%`);
      } else if (search?.kind === "number") {
        query = query.like("customer_wa_id", `%${search.value}%`);
      }
      const { data, error } = await query
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(LIST_LIMIT);
      if (error) throw error;
      return data;
    },
    refetchInterval,
    placeholderData: keepWithinOrg(orgId),
  });
}

export function useConversation(orgId: string, id: string, refetchInterval: number | false) {
  return useQuery({
    queryKey: conversationKeys.detail(orgId, id),
    queryFn: async (): Promise<ConversationRow | null> => {
      const { data, error } = await supabase
        .from("conversations")
        .select(CONVERSATION_COLUMNS)
        .eq("id", id)
        .eq("organization_id", orgId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    refetchInterval,
  });
}

export function useMessages(orgId: string, id: string, refetchInterval: number | false) {
  return useQuery({
    queryKey: conversationKeys.messages(orgId, id),
    queryFn: async (): Promise<{ messages: MessageRow[]; truncated: boolean }> => {
      // Newest first so a long thread shows its latest messages, then oldest → newest for display.
      const { data, error } = await supabase
        .from("messages")
        .select(MESSAGE_COLUMNS)
        .eq("conversation_id", id)
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(MESSAGE_LIMIT);
      if (error) throw error;
      return { messages: [...data].reverse(), truncated: data.length === MESSAGE_LIMIT };
    },
    refetchInterval,
  });
}

function useInvalidateConversations(orgId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: conversationKeys.all(orgId) }),
      queryClient.invalidateQueries({ queryKey: [...queryKeys.org(orgId), "dashboard"] }),
    ]);
}

export type ConversationPatch = Pick<
  TablesUpdate<"conversations">,
  "status" | "ai_paused" | "assigned_to"
>;

/** Updates the columns staff may change (status, ai_paused, assigned_to). */
export function useUpdateConversation(orgId: string, id: string) {
  const invalidate = useInvalidateConversations(orgId);
  return useMutation({
    mutationFn: async (patch: ConversationPatch) => {
      const { data, error } = await supabase
        .from("conversations")
        .update(patch)
        .eq("id", id)
        .eq("organization_id", orgId)
        .select("id");
      if (error) throw error;
      ensureAffected(data);
    },
    onSuccess: invalidate,
  });
}

/** Owner/admin only (RLS): deletes the conversation and, by cascade, all its messages. */
export function useDeleteConversation(orgId: string, id: string) {
  const invalidate = useInvalidateConversations(orgId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .delete()
        .eq("id", id)
        .eq("organization_id", orgId)
        .select("id");
      if (error) throw error;
      ensureAffected(data);
    },
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: conversationKeys.detail(orgId, id) });
      queryClient.removeQueries({ queryKey: conversationKeys.messages(orgId, id) });
      await invalidate();
    },
    meta: { silentError: true },
  });
}

export interface ReplyMessage {
  id: string;
  direction: "inbound" | "outbound";
  sender: string;
  body: string;
  status: MessageStatus;
  error_code: string | null;
  created_at: string;
}

export type ReplyInput =
  | { kind: "text"; body: string; pauseAi: boolean }
  | {
      kind: "template";
      name: string;
      language: string;
      bodyParams: string[];
      pauseAi: boolean;
    };

/** conversation-reply: the server sends it (WhatsApp) or stores it (web chat). */
export function useReply(orgId: string, conversationId: string) {
  const invalidate = useInvalidateConversations(orgId);
  return useMutation({
    mutationFn: (input: ReplyInput) =>
      callFunction<{ message: ReplyMessage }>(
        "conversation-reply",
        input.kind === "text"
          ? { conversation_id: conversationId, body: input.body, pause_ai: input.pauseAi }
          : {
              conversation_id: conversationId,
              template: {
                name: input.name,
                language: input.language,
                body_params: input.bodyParams,
              },
              pause_ai: input.pauseAi,
            },
        { timeout: 30_000 },
      ),
    onSettled: invalidate,
    meta: { silentError: true },
  });
}
