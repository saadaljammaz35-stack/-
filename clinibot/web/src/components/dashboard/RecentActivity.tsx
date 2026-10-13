import { CalendarClock, ChevronRight, MessagesSquare } from "lucide-react";
import { Link } from "react-router";
import { Badge, Card, CardHeader, EmptyState, Skeleton } from "@/components/ui";
import { QueryError } from "@/components/layout/QueryError";
import { useI18n } from "@/i18n";
import { AppointmentStatusBadge, SourceBadge } from "@/components/appointments/badges";
import {
  ChannelBadge,
  ConversationStatusBadge,
  CustomerName,
} from "@/components/conversations/badges";
import { needsReply } from "@/components/conversations/model";
import { useNow } from "./hooks";
import type { useRecentAppointments, useRecentConversations } from "./queries";
import { formatRelativeTime } from "./time";

function ListSkeleton() {
  return (
    <ul className="flex flex-col gap-3 p-5" aria-hidden="true">
      {Array.from({ length: 4 }, (_, index) => (
        <li key={index} className="flex items-center gap-3">
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-16" />
        </li>
      ))}
    </ul>
  );
}

function ViewAll({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-sm font-bold text-primary hover:bg-primary-soft"
    >
      {label}
      <ChevronRight className="flip-rtl size-4" aria-hidden="true" />
    </Link>
  );
}

export function RecentConversations({
  query,
}: {
  query: ReturnType<typeof useRecentConversations>;
}) {
  const { t, lang } = useI18n();
  const now = useNow();
  return (
    <Card as="section" aria-labelledby="recent-conversations">
      <CardHeader
        title={<span id="recent-conversations">{t("dashboard.recentConversations")}</span>}
        actions={<ViewAll to="/app/conversations?tab=all" label={t("dashboard.viewAll")} />}
      />
      {query.isPending ? (
        <ListSkeleton />
      ) : query.error ? (
        <div className="p-5">
          <QueryError error={query.error} onRetry={() => void query.refetch()} />
        </div>
      ) : query.data.length === 0 ? (
        <EmptyState
          icon={MessagesSquare}
          title={t("dashboard.recentConversationsEmpty")}
          text={t("dashboard.recentConversationsEmptyText")}
        />
      ) : (
        <ul className="divide-y divide-slate-100">
          {query.data.map((conversation) => {
            const time = conversation.last_message_at ?? conversation.created_at;
            return (
              <li key={conversation.id}>
                <Link
                  to={`/app/conversations/${conversation.id}`}
                  className="flex min-h-14 items-center gap-3 px-5 py-3 hover:bg-slate-50 focus-visible:bg-slate-50 sm:px-6"
                >
                  <div className="min-w-0 flex-1">
                    <CustomerName
                      conversation={conversation}
                      className="block truncate text-sm font-bold text-slate-900"
                    />
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <ChannelBadge channel={conversation.channel} />
                      {needsReply(conversation) ? (
                        <Badge tone="danger" dot>
                          {t("conversations.needsReply")}
                        </Badge>
                      ) : (
                        <ConversationStatusBadge status={conversation.status} />
                      )}
                    </div>
                  </div>
                  <time dateTime={time} className="shrink-0 text-xs text-slate-500">
                    {formatRelativeTime(lang, time, now)}
                  </time>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

export function RecentAppointments({ query }: { query: ReturnType<typeof useRecentAppointments> }) {
  const { t, lang } = useI18n();
  const now = useNow();
  return (
    <Card as="section" aria-labelledby="recent-appointments">
      <CardHeader
        title={<span id="recent-appointments">{t("dashboard.recentAppointments")}</span>}
        actions={<ViewAll to="/app/appointments?status=all" label={t("dashboard.viewAll")} />}
      />
      {query.isPending ? (
        <ListSkeleton />
      ) : query.error ? (
        <div className="p-5">
          <QueryError error={query.error} onRetry={() => void query.refetch()} />
        </div>
      ) : query.data.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title={t("dashboard.recentAppointmentsEmpty")}
          text={t("dashboard.recentAppointmentsEmptyText")}
        />
      ) : (
        <ul className="divide-y divide-slate-100">
          {query.data.map((request) => (
            <li key={request.id}>
              <Link
                to={`/app/appointments/${request.id}`}
                className="flex min-h-14 items-center gap-3 px-5 py-3 hover:bg-slate-50 focus-visible:bg-slate-50 sm:px-6"
              >
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-slate-900">
                    {request.customer_name}
                  </span>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <AppointmentStatusBadge status={request.status} />
                    <SourceBadge source={request.source} />
                  </div>
                </div>
                <time dateTime={request.created_at} className="shrink-0 text-xs text-slate-500">
                  {formatRelativeTime(lang, request.created_at, now)}
                </time>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
