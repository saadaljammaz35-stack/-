import type { ReactNode } from "react";
import { Headset, MessageCircleOff, RotateCcw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui";
import { useI18n } from "@/i18n";
import { errorReference, errorText } from "@/lib/errors";
import { cn } from "@/lib/cn";
import { telHref, type NoticeKind } from "./model";
import type { ChatProfile } from "./types";

function NoticeCard({
  icon: Icon,
  title,
  children,
  tone,
}: {
  icon: typeof Headset;
  title: string;
  children?: ReactNode;
  tone: "info" | "neutral";
}) {
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm",
        tone === "info"
          ? "border-sky-200 bg-sky-50 text-sky-950"
          : "border-slate-200 bg-white text-slate-800",
      )}
    >
      <Icon
        className={cn(
          "mt-0.5 size-5 shrink-0",
          tone === "info" ? "text-sky-700" : "text-slate-500",
        )}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1 leading-relaxed">
        <p className="font-bold">{title}</p>
        {children && <div className="mt-0.5">{children}</div>}
      </div>
    </div>
  );
}

export function ConversationNotice({ kind, profile }: { kind: NoticeKind; profile: ChatProfile }) {
  const { t, tRich } = useI18n();
  const phone = profile.reception_phone;
  const callLine = phone ? (
    <p className="mt-1">
      {tRich("chat.callForFaster", {
        phone: (
          <a
            href={telHref(phone)}
            dir="ltr"
            className="inline-flex font-bold text-primary underline underline-offset-2"
          >
            {phone}
          </a>
        ),
      })}
    </p>
  ) : null;

  if (kind === "awaiting_human") {
    return (
      <NoticeCard icon={Headset} title={t("chat.awaitingHuman")} tone="info">
        <p>{t("chat.awaitingHumanDetail")}</p>
        {callLine}
      </NoticeCard>
    );
  }
  if (kind === "assistant_unavailable") {
    return (
      <NoticeCard icon={MessageCircleOff} title={t("chat.assistantUnavailable")} tone="info">
        <p>{t("chat.assistantUnavailableDetail")}</p>
        {callLine}
      </NoticeCard>
    );
  }
  return (
    <NoticeCard icon={MessageCircleOff} title={t("chat.closedTitle")} tone="neutral">
      <p>{t("chat.closedDetail")}</p>
    </NoticeCard>
  );
}

/** Polling failed more than once: say so, keep retrying, offer "try now". */
export function ConnectionNotice({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { t, tRich } = useI18n();
  const reference = errorReference(error);
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[0.8125rem] text-amber-950"
    >
      <WifiOff className="size-4 shrink-0 text-amber-700" aria-hidden="true" />
      <p className="min-w-0 flex-1">
        {t("chat.connectionLost")} <span className="text-amber-900/80">{errorText(t, error)}</span>
        {reference && (
          <span className="block text-xs opacity-80">
            {tRich("errors.reference", {
              id: (
                <span dir="ltr" className="font-mono select-all">
                  {reference}
                </span>
              ),
            })}
          </span>
        )}
      </p>
      <Button
        size="sm"
        variant="outline"
        onClick={onRetry}
        icon={<RotateCcw className="size-4" aria-hidden="true" />}
      >
        {t("chat.retryNow")}
      </Button>
    </div>
  );
}
