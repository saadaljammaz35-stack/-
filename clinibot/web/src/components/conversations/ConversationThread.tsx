import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { ArrowLeft, MessageSquareOff, Phone } from "lucide-react";
import { Alert, Badge, EmptyState, Skeleton } from "@/components/ui";
import { QueryError } from "@/components/layout/QueryError";
import { useAuth } from "@/auth/useAuth";
import { useI18n } from "@/i18n";
import { useOrg } from "@/org/useOrg";
import { usePollInterval, useNow } from "@/components/dashboard/hooks";
import { useOrgMembers } from "@/components/dashboard/members";
import { formatDateTime, riyadhDateKey } from "@/components/dashboard/time";
import { ChannelBadge, ConversationStatusBadge, CustomerName } from "./badges";
import { ConversationActions } from "./ConversationActions";
import { MessageBubble } from "./MessageBubble";
import {
  HANDOFF_LABELS,
  parseHandoffReason,
  serviceWindow,
  waIdToE164,
  type ConversationRow,
  type MessageRow,
} from "./model";
import { MESSAGE_LIMIT, POLL_MS, useConversation, useMessages } from "./queries";
import { ReplyComposer } from "./ReplyComposer";

function BackLink({ search }: { search: string }) {
  const { t } = useI18n();
  return (
    <Link
      to={{ pathname: "/app/conversations", search }}
      className="-ms-2 inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-sm font-bold text-primary hover:bg-primary-soft lg:hidden"
    >
      <ArrowLeft className="flip-rtl size-4" aria-hidden="true" />
      {t("conversations.backToList")}
    </Link>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-sm text-slate-800">{children}</dd>
    </div>
  );
}

function PhoneReveal({ waId }: { waId: string }) {
  const { t } = useI18n();
  const [shown, setShown] = useState(false);
  const phone = waIdToE164(waId);
  if (!shown) {
    return (
      <button
        type="button"
        onClick={() => setShown(true)}
        className="-my-2 inline-flex min-h-11 items-center gap-1 rounded-lg font-bold text-primary hover:underline"
      >
        {t("conversations.showNumber")}
      </button>
    );
  }
  return (
    <a
      href={`tel:${phone}`}
      dir="ltr"
      className="-my-2 inline-flex min-h-11 items-center gap-1.5 font-bold text-primary hover:underline"
    >
      <Phone className="size-4" aria-hidden="true" />
      {phone}
    </a>
  );
}

function ThreadHeader({ conversation }: { conversation: ConversationRow }) {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const handoff = parseHandoffReason(conversation.handoff_reason);
  const language =
    conversation.language === "ar"
      ? t("conversations.languageAr")
      : conversation.language === "en"
        ? t("conversations.languageEn")
        : t("conversations.languageUnknown");
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="min-w-0 text-lg font-extrabold text-slate-900">
          <CustomerName conversation={conversation} />
        </h2>
        <ChannelBadge channel={conversation.channel} />
        <ConversationStatusBadge status={conversation.status} />
        {conversation.ai_paused && <Badge tone="neutral">{t("conversations.aiPaused")}</Badge>}
        {conversation.assigned_to && conversation.assigned_to === user?.id && (
          <Badge tone="brand">{t("conversations.assignedToMe")}</Badge>
        )}
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
        <Detail label={t("conversations.detailLanguage")}>{language}</Detail>
        <Detail label={t("conversations.detailConsent")}>
          {conversation.consent_at
            ? formatDateTime(lang, conversation.consent_at)
            : t("conversations.consentNone")}
        </Detail>
        {conversation.channel === "whatsapp" && conversation.customer_wa_id && (
          <Detail label={t("conversations.detailNumber")}>
            <PhoneReveal waId={conversation.customer_wa_id} />
          </Detail>
        )}
      </dl>
      {handoff && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <p className="font-bold">
            {t("conversations.handoffReason")}:{" "}
            {handoff.code ? t(HANDOFF_LABELS[handoff.code]) : t("conversations.handoffOther")}
          </p>
          {handoff.summary && (
            <p className="mt-0.5 leading-relaxed" dir="auto">
              {handoff.summary}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** Day separators: "Today" / "Yesterday" / the date, in Riyadh time. */
function useDayLabel() {
  const { t, formatDate } = useI18n();
  const now = useNow();
  const today = riyadhDateKey(now);
  const yesterday = riyadhDateKey(new Date(now.getTime() - 86_400_000));
  return (day: string) =>
    day === today
      ? t("conversations.today")
      : day === yesterday
        ? t("conversations.yesterday")
        : formatDate(day, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function MessageLog({
  messages,
  truncated,
  channel,
}: {
  messages: MessageRow[];
  truncated: boolean;
  channel: ConversationRow["channel"];
}) {
  const { t } = useI18n();
  const dayLabel = useDayLabel();
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const lastId = messages[messages.length - 1]?.id;

  // Follow new messages only while the reader is at the bottom.
  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (element && stickToBottom.current) element.scrollTop = element.scrollHeight;
  }, [lastId]);

  const groups = useMemo(() => {
    const result: Array<{ day: string; messages: MessageRow[] }> = [];
    for (const message of messages) {
      const day = riyadhDateKey(message.created_at);
      const last = result[result.length - 1];
      if (last && last.day === day) last.messages.push(message);
      else result.push({ day, messages: [message] });
    }
    return result;
  }, [messages]);

  return (
    <div
      ref={scrollRef}
      onScroll={(event) => {
        const element = event.currentTarget;
        stickToBottom.current =
          element.scrollHeight - element.scrollTop - element.clientHeight < 80;
      }}
      className="h-[60dvh] min-h-72 overflow-y-auto overscroll-contain bg-canvas px-3 py-4 sm:px-5 lg:h-auto lg:min-h-64 lg:flex-1"
      tabIndex={0}
      role="log"
      aria-label={t("conversations.messagesLabel")}
    >
      {truncated && (
        <p className="mb-3 text-center text-xs text-slate-500">
          {t("conversations.messagesTruncated", { n: MESSAGE_LIMIT })}
        </p>
      )}
      {messages.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">{t("conversations.noMessages")}</p>
      ) : (
        groups.map((group) => (
          <section key={group.day} aria-label={dayLabel(group.day)} className="mb-4">
            <p className="mb-3 flex justify-center">
              <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-500 shadow-xs ring-1 ring-slate-200">
                {dayLabel(group.day)}
              </span>
            </p>
            <ol className="flex flex-col gap-2.5">
              {group.messages.map((message) => (
                <MessageBubble key={message.id} message={message} channel={channel} />
              ))}
            </ol>
          </section>
        ))
      )}
    </div>
  );
}

export function ConversationThread({
  orgId,
  id,
  listSearch,
}: {
  orgId: string;
  id: string;
  listSearch: string;
}) {
  const { t, lang, formatNumber } = useI18n();
  const { role } = useOrg();
  const poll = usePollInterval(POLL_MS);
  const now = useNow(30_000);
  const conversationQuery = useConversation(orgId, id, poll);
  const messagesQuery = useMessages(orgId, id, poll);
  const members = useOrgMembers(orgId);
  const headingRef = useRef<HTMLDivElement>(null);

  const conversation = conversationQuery.data;
  const loaded = Boolean(conversation);

  // Once the opened conversation has loaded, move focus to it (keyboard and screen-reader users).
  useEffect(() => {
    if (loaded) headingRef.current?.focus({ preventScroll: true });
  }, [loaded]);

  if (conversationQuery.isPending) {
    return (
      <div className="flex flex-col gap-4 p-5" aria-busy="true">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (conversationQuery.error) {
    return (
      <div className="flex flex-col gap-3 p-5">
        <BackLink search={listSearch} />
        <QueryError
          error={conversationQuery.error}
          onRetry={() => void conversationQuery.refetch()}
        />
      </div>
    );
  }
  if (!conversation) {
    return (
      <div className="p-5">
        <BackLink search={listSearch} />
        <EmptyState
          icon={MessageSquareOff}
          title={t("conversations.notFoundTitle")}
          text={t("conversations.notFoundText")}
        />
      </div>
    );
  }

  const replyWindow = serviceWindow(conversation.last_inbound_at, now);
  const isWhatsapp = conversation.channel === "whatsapp";
  const hoursLeft = Math.max(1, Math.ceil(replyWindow.msLeft / 3_600_000));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={headingRef}
        tabIndex={-1}
        className="flex flex-col gap-4 border-b border-slate-100 p-4 outline-none sm:p-5"
      >
        <BackLink search={listSearch} />
        <ThreadHeader conversation={conversation} />
        <ConversationActions
          orgId={orgId}
          conversation={conversation}
          role={role}
          members={members.data}
          listSearch={listSearch}
        />
      </div>

      {(conversation.opted_out_at || isWhatsapp) && (
        <div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-3 sm:px-5">
          {conversation.opted_out_at && (
            <Alert tone="warning" title={t("conversations.optedOutTitle")}>
              {t("conversations.optedOutText", {
                time: formatDateTime(lang, conversation.opted_out_at),
              })}
            </Alert>
          )}
          {isWhatsapp &&
            !conversation.opted_out_at &&
            (replyWindow.open && replyWindow.closesAt ? (
              <Alert tone="info">
                {t("conversations.windowOpen", {
                  time: formatDateTime(lang, replyWindow.closesAt),
                  hours: formatNumber(hoursLeft),
                })}
              </Alert>
            ) : (
              <Alert tone="warning" title={t("conversations.windowClosedTitle")}>
                {replyWindow.closesAt
                  ? t("conversations.windowClosedText", {
                      time: formatDateTime(lang, replyWindow.closesAt),
                    })
                  : t("conversations.windowNeverText")}
              </Alert>
            ))}
        </div>
      )}

      {messagesQuery.isPending ? (
        <div className="flex-1 p-5">
          <Skeleton className="h-32 w-full" />
        </div>
      ) : messagesQuery.error ? (
        <div className="flex-1 p-5">
          <QueryError error={messagesQuery.error} onRetry={() => void messagesQuery.refetch()} />
        </div>
      ) : (
        <MessageLog
          messages={messagesQuery.data.messages}
          truncated={messagesQuery.data.truncated}
          channel={conversation.channel}
        />
      )}

      <div className="border-t border-slate-200 bg-white p-4 sm:p-5">
        {conversation.opted_out_at ? (
          <p className="text-sm text-slate-600">{t("conversations.composerOptedOut")}</p>
        ) : (
          <ReplyComposer
            key={conversation.id}
            orgId={orgId}
            conversation={conversation}
            windowOpen={replyWindow.open}
          />
        )}
      </div>
    </div>
  );
}
