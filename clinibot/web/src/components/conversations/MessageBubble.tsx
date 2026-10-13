import { useState } from "react";
import { Bot, Check, CheckCheck, CircleAlert, Clock, Info, UserRound } from "lucide-react";
import { useI18n, type MessageKey } from "@/i18n";
import { cn } from "@/lib/cn";
import type { ConversationChannel, MessageRow, MessageStatus } from "./model";

const STATUS_LABELS: Partial<Record<MessageStatus, MessageKey>> = {
  pending: "conversations.deliveryPending",
  sent: "conversations.deliverySent",
  delivered: "conversations.deliveryDelivered",
  read: "conversations.deliveryRead",
  failed: "conversations.deliveryFailed",
};

/**
 * WhatsApp delivery state of an outbound message, as reported by Meta. A
 * failed message shows Meta's error code on tap (never only on hover).
 */
function DeliveryStatus({
  status,
  errorCode,
}: {
  status: MessageStatus;
  errorCode: string | null;
}) {
  const { t } = useI18n();
  const [showCode, setShowCode] = useState(false);
  const label = STATUS_LABELS[status];
  if (!label) return null;

  if (status === "failed") {
    return (
      <span className="inline-flex flex-col items-end gap-1">
        <button
          type="button"
          onClick={() => setShowCode((value) => !value)}
          aria-expanded={showCode}
          title={errorCode ? t("conversations.deliveryErrorCode", { code: errorCode }) : undefined}
          className="-my-2 inline-flex min-h-9 items-center gap-1 rounded-md px-1 font-bold text-red-700 underline decoration-dotted underline-offset-2 hover:bg-red-50 pointer-coarse:min-h-11"
        >
          <CircleAlert className="size-3.5" aria-hidden="true" />
          {t(label)}
        </button>
        {showCode && (
          <span className="rounded-md bg-red-50 px-2 py-1 text-red-800" role="status">
            {errorCode
              ? t("conversations.deliveryErrorCode", { code: errorCode })
              : t("conversations.deliveryNoCode")}
          </span>
        )}
      </span>
    );
  }

  const Icon = status === "pending" ? Clock : status === "sent" ? Check : CheckCheck;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1",
        status === "read" ? "text-sky-700" : "text-slate-500",
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {t(label)}
    </span>
  );
}

export function MessageBubble({
  message,
  channel,
}: {
  message: MessageRow;
  channel: ConversationChannel;
}) {
  const { t, formatDate } = useI18n();
  const time = formatDate(message.created_at, { hour: "numeric", minute: "2-digit" });

  if (message.sender === "system") {
    return (
      <li className="flex justify-center px-2">
        <div className="max-w-[min(32rem,92%)] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[0.8125rem] leading-relaxed text-slate-600">
          <p className="mb-0.5 flex items-center gap-1.5 text-xs font-bold text-slate-500">
            <Info className="size-3.5" aria-hidden="true" />
            {t("conversations.senderSystem")}
            <span aria-hidden="true">·</span>
            <time dateTime={message.created_at} className="font-medium">
              {time}
            </time>
          </p>
          <p className="break-words whitespace-pre-wrap">{message.body}</p>
          {channel === "whatsapp" && message.direction === "outbound" && (
            <p className="mt-1 flex justify-end text-xs">
              <DeliveryStatus status={message.status} errorCode={message.error_code} />
            </p>
          )}
        </div>
      </li>
    );
  }

  const fromCustomer = message.direction === "inbound";
  const staff = message.sender === "staff";
  const senderLabel = fromCustomer
    ? t("conversations.senderCustomer")
    : staff
      ? t("conversations.senderStaff")
      : t("conversations.senderAssistant");

  return (
    <li className={cn("flex", fromCustomer ? "justify-start" : "justify-end")}>
      <div
        className={cn(
          "max-w-[min(34rem,88%)] rounded-2xl px-3.5 py-2.5 text-[0.9375rem] leading-relaxed shadow-xs",
          fromCustomer && "rounded-ss-md border border-slate-200 bg-white text-slate-900",
          !fromCustomer && staff && "rounded-se-md bg-primary text-white",
          !fromCustomer &&
            !staff &&
            "rounded-se-md border border-navy-100 bg-navy-50 text-slate-900",
        )}
      >
        <p
          className={cn(
            "mb-0.5 flex items-center gap-1.5 text-xs font-bold",
            staff ? "text-navy-100" : "text-slate-500",
          )}
        >
          {fromCustomer ? (
            <UserRound className="size-3.5" aria-hidden="true" />
          ) : staff ? (
            <UserRound className="size-3.5" aria-hidden="true" />
          ) : (
            <Bot className="size-3.5" aria-hidden="true" />
          )}
          {senderLabel}
        </p>
        <p className="break-words whitespace-pre-wrap" dir="auto">
          {message.body}
        </p>
        <p
          className={cn(
            "mt-1 flex flex-wrap items-center justify-end gap-x-2 text-xs",
            staff ? "text-navy-100" : "text-slate-500",
          )}
        >
          <time dateTime={message.created_at}>{time}</time>
          {channel === "whatsapp" && !fromCustomer && (
            <span className={cn(staff && "rounded-md bg-white px-1.5 py-0.5")}>
              <DeliveryStatus status={message.status} errorCode={message.error_code} />
            </span>
          )}
          {channel === "web" && !fromCustomer && message.status === "failed" && (
            <span className={cn("font-bold", staff ? "text-white" : "text-red-700")}>
              {t("conversations.deliveryFailed")}
            </span>
          )}
        </p>
      </div>
    </li>
  );
}
