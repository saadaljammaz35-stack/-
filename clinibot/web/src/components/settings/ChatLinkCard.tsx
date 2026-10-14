import { Copy, ExternalLink } from "lucide-react";
import { Badge, Button, ButtonLink, Card, CardBody, CardHeader, useToast } from "@/components/ui";
import { useI18n } from "@/i18n";
import { chatUrl } from "./model";

/** The patient chat link /c/<slug>. The slug is fixed once the clinic exists. */
export function ChatLinkCard({
  slug,
  publicChatEnabled,
}: {
  slug: string;
  /** null while clinic settings are unknown. */
  publicChatEnabled: boolean | null;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const url = chatUrl(slug, window.location.origin);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("settings.linkCopied"));
    } catch {
      toast.error(t("settings.copyFailed"));
    }
  }

  return (
    <Card as="section" aria-labelledby="chat-link-title">
      <CardHeader
        title={<span id="chat-link-title">{t("settings.chatLinkTitle")}</span>}
        description={t("settings.chatLinkDescription")}
        actions={
          publicChatEnabled === null ? undefined : publicChatEnabled ? (
            <Badge tone="success" dot>
              {t("settings.chatOn")}
            </Badge>
          ) : (
            <Badge tone="warning" dot>
              {t("settings.chatOff")}
            </Badge>
          )
        }
      />
      <CardBody className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-bold text-slate-800">{t("settings.chatLinkLabel")}</p>
          <p
            dir="ltr"
            className="rounded-xl bg-slate-50 px-3.5 py-3 text-start font-mono text-sm break-all text-slate-900 ring-1 ring-slate-200 ring-inset select-all"
          >
            {url}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button
            variant="outline"
            onClick={() => void copy()}
            icon={<Copy className="size-4" aria-hidden="true" />}
          >
            {t("settings.copyLink")}
          </Button>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-[0.9375rem] font-bold text-primary hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <ExternalLink className="flip-rtl size-4" aria-hidden="true" />
            {t("settings.openLink")}
            <span className="sr-only">{t("common.opensInNewTab")}</span>
          </a>
        </div>
        {publicChatEnabled === false && (
          <div className="flex flex-col gap-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-950 ring-1 ring-amber-200 ring-inset">
            <p className="leading-relaxed">{t("settings.chatOffText")}</p>
            <div>
              <ButtonLink to="/app/assistant" variant="outline" size="sm">
                {t("settings.goToAssistant")}
              </ButtonLink>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
