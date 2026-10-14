import { MessagesSquare } from "lucide-react";
import { useParams } from "react-router";
import { Card, EmptyState } from "@/components/ui";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/cn";
import { useCurrentOrg } from "@/org/useOrg";
import { ConversationList } from "./ConversationList";
import { ConversationThread } from "./ConversationThread";
import { WORKSPACE_GRID } from "./layout";
import { useListFilters } from "./useListFilters";

/**
 * The inbox (the page header lives in ConversationsPage). Desktop (lg+): list
 * and thread side by side. Phones: the list, or the open conversation with a
 * back link.
 */
export function ConversationsWorkspace() {
  const { t } = useI18n();
  const org = useCurrentOrg();
  const { id } = useParams();
  const filters = useListFilters();
  const listSearch = filters.query ? `?${filters.query}` : "";

  return (
    <div className={WORKSPACE_GRID}>
      <Card
        as="section"
        aria-label={t("conversations.listLabel")}
        className={cn("flex min-h-0 flex-col overflow-hidden", id && "max-lg:hidden")}
      >
        <ConversationList orgId={org.id} selectedId={id} />
      </Card>
      <Card
        as="section"
        aria-label={t("conversations.threadLabel")}
        // Desktop: a fixed-height pane (scrolls as a whole only if the window is very short).
        // Phones: natural page flow, with the message log as its own scroll area.
        className={cn(
          "flex min-h-0 flex-col overflow-hidden lg:overflow-y-auto",
          !id && "max-lg:hidden",
        )}
      >
        {id ? (
          <ConversationThread key={id} orgId={org.id} id={id} listSearch={listSearch} />
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <EmptyState
              icon={MessagesSquare}
              title={t("conversations.pickTitle")}
              text={t("conversations.pickText")}
            />
          </div>
        )}
      </Card>
    </div>
  );
}
