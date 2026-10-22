import { Globe, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui";
import { useI18n } from "@/i18n";
import { customerLabel, type ConversationChannel, type ConversationStatus } from "./model";

/** The customer label, with numbers kept left-to-right inside Arabic text. */
export function CustomerName({
  conversation,
  className,
}: {
  conversation: Parameters<typeof customerLabel>[0];
  className?: string;
}) {
  const { t } = useI18n();
  const label = customerLabel(conversation, t);
  // The outer element keeps the page direction (so it aligns with named rows); only the
  // number itself is isolated left-to-right.
  return (
    <span className={className}>
      {label.isNumber ? <bdi dir="ltr">{label.text}</bdi> : label.text}
    </span>
  );
}

export function ChannelBadge({ channel }: { channel: ConversationChannel }) {
  const { t } = useI18n();
  return channel === "whatsapp" ? (
    <Badge tone="success" icon={<MessageCircle className="size-3.5" aria-hidden="true" />}>
      {t("conversations.channelWhatsapp")}
    </Badge>
  ) : (
    <Badge tone="brand" icon={<Globe className="size-3.5" aria-hidden="true" />}>
      {t("conversations.channelWeb")}
    </Badge>
  );
}

export function ConversationStatusBadge({ status }: { status: ConversationStatus }) {
  const { t } = useI18n();
  if (status === "awaiting_human")
    return (
      <Badge tone="warning" dot>
        {t("conversations.statusAwaiting")}
      </Badge>
    );
  if (status === "closed") return <Badge tone="neutral">{t("conversations.statusClosed")}</Badge>;
  return (
    <Badge tone="info" dot>
      {t("conversations.statusOpen")}
    </Badge>
  );
}
