import { memo, useMemo } from "react";
import { Bot, Clock, MessageCircleHeart, UserRound } from "lucide-react";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/cn";
import {
  groupMessages,
  isWelcomeMessage,
  linkify,
  timestampToDate,
  type MessageGroup,
} from "./model";
import type { ChatProfile, TimelineMessage } from "./types";

/** Message text: keeps line breaks, wraps long words/links, follows its own language direction. */
function MessageText({
  body,
  tone,
  small = false,
}: {
  body: string;
  tone: "light" | "dark";
  small?: boolean;
}) {
  const { t } = useI18n();
  const segments = useMemo(() => linkify(body), [body]);
  return (
    <p
      dir="auto"
      className={cn(
        "leading-relaxed break-words whitespace-pre-wrap [overflow-wrap:anywhere]",
        small ? "text-[0.8125rem]" : "text-[0.9375rem]",
      )}
    >
      {segments.map((segment, index) =>
        segment.kind === "link" ? (
          <a
            key={index}
            href={segment.href}
            target="_blank"
            rel="noopener noreferrer nofollow"
            dir="ltr"
            className={cn(
              "font-medium underline underline-offset-2",
              tone === "dark" ? "text-white" : "text-primary",
            )}
          >
            {segment.text}
            <span className="sr-only"> {t("common.opensInNewTab")}</span>
          </a>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </p>
  );
}

function MessageTime({ message }: { message: TimelineMessage }) {
  const { t, formatDate } = useI18n();
  if (message.pending) {
    return (
      <span className="inline-flex items-center gap-1">
        <Clock className="size-3.5" aria-hidden="true" />
        {t("chat.sending")}
      </span>
    );
  }
  const date = timestampToDate(message.at);
  return (
    <time dateTime={date.toISOString()}>
      {formatDate(date, { hour: "numeric", minute: "2-digit" })}
    </time>
  );
}

function SystemNotice({ message, welcome }: { message: TimelineMessage; welcome: boolean }) {
  const { t } = useI18n();
  if (welcome) {
    return (
      <div className="mx-auto w-full max-w-md rounded-2xl border border-emerald-100 bg-white px-4 py-3.5 text-slate-800 shadow-card">
        <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-accent-strong">
          <MessageCircleHeart className="size-4" aria-hidden="true" />
          {t("chat.welcomeLabel")}
        </p>
        <MessageText body={message.body} tone="light" />
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-[min(32rem,92%)] rounded-xl bg-slate-100 px-3.5 py-2 text-center text-slate-600">
      <span className="sr-only">{t("chat.systemNotice")}: </span>
      <MessageText body={message.body} tone="light" small />
    </div>
  );
}

const GroupView = memo(function GroupView({
  group,
  profile,
}: {
  group: MessageGroup;
  profile: ChatProfile;
}) {
  const { t } = useI18n();
  const last = group.messages[group.messages.length - 1];

  if (group.side === "center") {
    return (
      <div className="flex flex-col gap-1.5">
        {group.messages.map((message) => (
          <SystemNotice
            key={message.id}
            message={message}
            welcome={isWelcomeMessage(message, profile)}
          />
        ))}
        {last && (
          <p className="text-center text-[0.6875rem] text-slate-500">
            <MessageTime message={last} />
          </p>
        )}
      </div>
    );
  }

  const mine = group.side === "end";
  const staff = group.sender === "staff";
  const label = mine ? t("chat.you") : staff ? t("chat.clinicTeam") : profile.assistant_name;

  return (
    <div className={cn("flex flex-col gap-1", mine ? "items-end" : "items-start")}>
      {mine ? (
        <span className="sr-only">{label}:</span>
      ) : (
        <p
          className={cn(
            "flex items-center gap-1.5 px-1 text-xs font-bold",
            staff ? "text-accent-strong" : "text-slate-600",
          )}
        >
          {staff ? (
            <UserRound className="size-3.5" aria-hidden="true" />
          ) : (
            <Bot className="size-3.5" aria-hidden="true" />
          )}
          <span>{label}</span>
        </p>
      )}
      {group.messages.map((message, index) => {
        const isLast = index === group.messages.length - 1;
        return (
          <div
            key={message.id}
            className={cn(
              "max-w-[85%] rounded-2xl px-3.5 py-2.5 sm:max-w-[75%]",
              mine
                ? "bg-primary text-white"
                : staff
                  ? "border border-emerald-200 bg-mint text-slate-900"
                  : "border border-slate-200 bg-white text-slate-900 shadow-card",
              isLast && (mine ? "rounded-ee-md" : "rounded-es-md"),
              message.pending && "opacity-75",
            )}
          >
            <MessageText body={message.body} tone={mine ? "dark" : "light"} />
          </div>
        );
      })}
      {last && (
        <p className="px-1 text-[0.6875rem] text-slate-500">
          <MessageTime message={last} />
        </p>
      )}
    </div>
  );
});

export type TypingKind = "assistant" | "sending" | null;

function TypingIndicator({
  kind,
  assistantName,
}: {
  kind: "assistant" | "sending";
  assistantName: string;
}) {
  const { t } = useI18n();
  return (
    <div className="flex items-start">
      <div className="inline-flex items-center gap-1 rounded-2xl rounded-es-md border border-slate-200 bg-white px-4 py-3 shadow-card">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="size-2 animate-bounce rounded-full bg-slate-400"
            style={{ animationDelay: `${delay}ms` }}
            aria-hidden="true"
          />
        ))}
        <span className="sr-only">
          {kind === "assistant"
            ? t("chat.typingAssistant", { name: assistantName })
            : t("chat.typingSending")}
        </span>
      </div>
    </div>
  );
}

export interface MessageListProps {
  messages: readonly TimelineMessage[];
  profile: ChatProfile;
  typing: TypingKind;
}

/** The conversation, oldest first. New messages are announced by the page's live region. */
export function MessageList({ messages, profile, typing }: MessageListProps) {
  const { t } = useI18n();
  const groups = useMemo(() => groupMessages(messages), [messages]);
  return (
    <ol aria-label={t("chat.messagesLabel")} className="flex flex-col gap-4">
      {groups.map((group) => (
        <li key={group.key}>
          <GroupView group={group} profile={profile} />
        </li>
      ))}
      {typing && (
        <li>
          <TypingIndicator kind={typing} assistantName={profile.assistant_name} />
        </li>
      )}
    </ol>
  );
}
