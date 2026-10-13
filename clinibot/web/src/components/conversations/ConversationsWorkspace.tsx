import { MessagesSquare } from "lucide-react";
import { useParams } from "react-router";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/cn";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import { useCurrentOrg } from "@/org/useOrg";
import { ConversationList } from "./ConversationList";
import { ConversationThread } from "./ConversationThread";
import { useListFilters } from "./useListFilters";

/**
 * The inbox. Desktop (lg+): list and thread side by side. Phones: the list,
 * or the open conversation with a back link.
 */
export function ConversationsWorkspace() {
  const { t } = useI18n();
  const org = useCurrentOrg();
  const { id } = useParams();
  const filters = useListFilters();
  const listSearch = filters.query ? `?${filters.query}` : "";
  useDocumentTitle(t("conversations.title"));

  return (
    <>
      <PageHeader
        title={t("conversations.title")}
        description={t("conversations.description")}
        className={cn(id && "max-lg:sr-only")}
      />
      <div className="grid grid-cols-1 gap-4 lg:h-[calc(100dvh-13rem)] lg:min-h-[36rem] lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)]">
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
    </>
  );
}
