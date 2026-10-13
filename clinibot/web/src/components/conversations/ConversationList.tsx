import { useEffect, useRef, useState } from "react";
import { Ban, Inbox, PauseCircle, Search, UserRound } from "lucide-react";
import { Link } from "react-router";
import {
  Badge,
  EmptyState,
  Field,
  Input,
  Select,
  Skeleton,
  TabList,
  TabPanel,
  Tabs,
} from "@/components/ui";
import { QueryError } from "@/components/layout/QueryError";
import { useAuth } from "@/auth/useAuth";
import { useI18n, type MessageKey } from "@/i18n";
import { cn } from "@/lib/cn";
import { usePollInterval, useNow } from "@/components/dashboard/hooks";
import { memberNameMap, useOrgMembers } from "@/components/dashboard/members";
import { formatRelativeTime } from "@/components/dashboard/time";
import { ChannelBadge, CustomerName } from "./badges";
import {
  CONVERSATION_TABS,
  HANDOFF_LABELS,
  needsReply,
  parseHandoffReason,
  TAB_LABELS,
  type ConversationRow,
  type ConversationTab,
} from "./model";
import { LIST_LIMIT, POLL_MS, useConversationList } from "./queries";
import { useListFilters } from "./useListFilters";

function ConversationItem({
  conversation,
  selected,
  search,
  myId,
  names,
  now,
}: {
  conversation: ConversationRow;
  selected: boolean;
  search: string;
  myId: string | null;
  names: Map<string, string>;
  now: Date;
}) {
  const { t, lang } = useI18n();
  const time = conversation.last_message_at ?? conversation.created_at;
  const handoff = parseHandoffReason(conversation.handoff_reason);
  const reply = needsReply(conversation);
  return (
    <li>
      <Link
        to={{ pathname: `/app/conversations/${conversation.id}`, search }}
        aria-current={selected ? "page" : undefined}
        className={cn(
          "flex flex-col gap-1.5 border-s-4 px-4 py-3 transition-colors",
          selected
            ? "border-primary bg-primary-soft"
            : "border-transparent hover:bg-slate-50 focus-visible:bg-slate-50",
        )}
      >
        <div className="flex items-baseline gap-2">
          <CustomerName
            conversation={conversation}
            className={cn(
              "min-w-0 flex-1 truncate text-[0.9375rem] text-slate-900",
              reply ? "font-extrabold" : "font-bold",
            )}
          />
          <time dateTime={time} className="shrink-0 text-xs text-slate-500">
            {formatRelativeTime(lang, time, now)}
          </time>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <ChannelBadge channel={conversation.channel} />
          {conversation.status === "awaiting_human" ? (
            <Badge tone="warning" dot>
              {t("conversations.statusAwaiting")}
            </Badge>
          ) : reply ? (
            <Badge tone="danger" dot>
              {t("conversations.needsReply")}
            </Badge>
          ) : conversation.status === "closed" ? (
            <Badge tone="neutral">{t("conversations.statusClosed")}</Badge>
          ) : null}
          {handoff?.code && <Badge tone="warning">{t(HANDOFF_LABELS[handoff.code])}</Badge>}
          {conversation.ai_paused && (
            <Badge tone="neutral" icon={<PauseCircle className="size-3.5" aria-hidden="true" />}>
              {t("conversations.aiPaused")}
            </Badge>
          )}
          {conversation.opted_out_at && (
            <Badge tone="danger" icon={<Ban className="size-3.5" aria-hidden="true" />}>
              {t("conversations.optedOut")}
            </Badge>
          )}
          {conversation.assigned_to &&
            (conversation.assigned_to === myId ? (
              <Badge tone="brand" icon={<UserRound className="size-3.5" aria-hidden="true" />}>
                {t("conversations.assignedToMe")}
              </Badge>
            ) : (
              <Badge tone="neutral" icon={<UserRound className="size-3.5" aria-hidden="true" />}>
                {t("conversations.assignedTo", {
                  name: names.get(conversation.assigned_to) ?? t("conversations.formerMember"),
                })}
              </Badge>
            ))}
        </div>
      </Link>
    </li>
  );
}

const EMPTY_TEXT: Record<ConversationTab, { title: MessageKey; text: MessageKey }> = {
  needs_reply: {
    title: "conversations.emptyNeedsReplyTitle",
    text: "conversations.emptyNeedsReplyText",
  },
  awaiting: { title: "conversations.emptyAwaitingTitle", text: "conversations.emptyAwaitingText" },
  open: { title: "conversations.emptyOpenTitle", text: "conversations.emptyOpenText" },
  closed: { title: "conversations.emptyClosedTitle", text: "conversations.emptyClosedText" },
  all: { title: "conversations.emptyAllTitle", text: "conversations.emptyAllText" },
};

export function ConversationList({ orgId, selectedId }: { orgId: string; selectedId?: string }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const filters = useListFilters();
  const poll = usePollInterval(POLL_MS);
  const [searchDraft, setSearchDraft] = useState(filters.search);
  const members = useOrgMembers(orgId);
  const names = memberNameMap(members.data);

  const now = useNow();
  const updateFilters = useRef(filters.update);
  useEffect(() => {
    updateFilters.current = filters.update;
  });

  // Debounce typing into the address (and so into the query).
  useEffect(() => {
    const value = searchDraft.trim();
    if (value === filters.search) return;
    const timer = window.setTimeout(() => updateFilters.current({ q: value }), 350);
    return () => window.clearTimeout(timer);
  }, [searchDraft, filters.search]);

  const query = useConversationList(
    orgId,
    { tab: filters.tab, channel: filters.channel, search: filters.search },
    poll,
  );
  const searchSuffix = filters.query ? `?${filters.query}` : "";
  const filtered = Boolean(filters.search) || filters.channel !== "all";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_10rem] lg:grid-cols-1 xl:grid-cols-[minmax(0,1fr)_9rem]">
          <Field label={t("conversations.searchLabel")} hideLabel>
            <Input
              type="search"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder={t("conversations.searchPlaceholder")}
              startAdornment={<Search className="size-5" aria-hidden="true" />}
              autoComplete="off"
              enterKeyHint="search"
            />
          </Field>
          <Field label={t("conversations.channelFilter")} hideLabel>
            <Select
              value={filters.channel}
              onChange={(event) => filters.update({ channel: event.target.value })}
            >
              <option value="all">{t("conversations.channelAll")}</option>
              <option value="web">{t("conversations.channelWeb")}</option>
              <option value="whatsapp">{t("conversations.channelWhatsapp")}</option>
            </Select>
          </Field>
        </div>
      </div>

      <Tabs
        value={filters.tab}
        onValueChange={(tab) => filters.update({ tab })}
        className="flex min-h-0 flex-1 flex-col"
      >
        <TabList
          label={t("conversations.tabsLabel")}
          className="px-3"
          items={CONVERSATION_TABS.map((tab) => ({ value: tab, label: t(TAB_LABELS[tab]) }))}
        />
        <TabPanel value={filters.tab} className="min-h-0 flex-1 overflow-y-auto pt-1!">
          {query.isPending ? (
            <ul className="flex flex-col gap-4 px-4 pb-4" aria-hidden="true">
              {Array.from({ length: 5 }, (_, index) => (
                <li key={index} className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-5 w-1/2" />
                </li>
              ))}
            </ul>
          ) : query.error ? (
            <div className="px-4 pb-4">
              <QueryError error={query.error} onRetry={() => void query.refetch()} />
            </div>
          ) : query.data.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title={
                filtered ? t("conversations.emptySearchTitle") : t(EMPTY_TEXT[filters.tab].title)
              }
              text={filtered ? t("conversations.emptySearchText") : t(EMPTY_TEXT[filters.tab].text)}
            />
          ) : (
            <>
              <ul
                className="flex flex-col divide-y divide-slate-100 pb-2"
                aria-label={t("conversations.listLabel")}
              >
                {query.data.map((conversation) => (
                  <ConversationItem
                    key={conversation.id}
                    conversation={conversation}
                    selected={conversation.id === selectedId}
                    search={searchSuffix}
                    myId={user?.id ?? null}
                    names={names}
                    now={now}
                  />
                ))}
              </ul>
              {query.data.length >= LIST_LIMIT && (
                <p className="px-4 pb-4 text-xs text-slate-500">
                  {t("conversations.listLimited", { n: LIST_LIMIT })}
                </p>
              )}
            </>
          )}
        </TabPanel>
      </Tabs>
    </div>
  );
}
