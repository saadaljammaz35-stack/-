import { useSearchParams } from "react-router";
import {
  isChannelFilter,
  isConversationTab,
  type ChannelFilter,
  type ConversationTab,
} from "./model";

/** Reads the list filters from the address (?tab=&channel=&q=), so they survive reloads and links. */
export function useListFilters() {
  const [params, setParams] = useSearchParams();
  const tabParam = params.get("tab");
  const channelParam = params.get("channel");
  const tab: ConversationTab = isConversationTab(tabParam) ? tabParam : "needs_reply";
  const channel: ChannelFilter = isChannelFilter(channelParam) ? channelParam : "all";
  const search = params.get("q") ?? "";

  function update(patch: Partial<Record<"tab" | "channel" | "q", string>>) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(patch)) {
          const isDefault =
            !value ||
            (key === "tab" && value === "needs_reply") ||
            (key === "channel" && value === "all");
          if (isDefault) next.delete(key);
          else next.set(key, value);
        }
        return next;
      },
      { replace: true },
    );
  }

  return { tab, channel, search, update, query: params.toString() };
}
