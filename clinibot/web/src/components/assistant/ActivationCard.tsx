import { useState } from "react";
import { ExternalLink } from "lucide-react";
import {
  Alert,
  buttonClasses,
  Card,
  CardBody,
  CardHeader,
  Input,
  SkeletonText,
  Switch,
} from "@/components/ui";
import { QueryError } from "@/components/layout/QueryError";
import { useI18n } from "@/i18n";
import { describeError, errorReference, errorText } from "@/lib/errors";
import { CopyButton } from "./CopyButton";
import { canEnableAssistant, patientChatUrl, TEST_VALID_DAYS, type AiStatus } from "./model";
import { useAssistantSettings, useSetAssistantFlag } from "./queries";

export interface ActivationCardProps {
  orgId: string;
  slug: string;
  canEdit: boolean;
  ai: AiStatus | undefined;
  now: Date;
}

/** The two switches patients feel: the assistant replying, and the public web chat link. */
export function ActivationCard({ orgId, slug, canEdit, ai, now }: ActivationCardProps) {
  const { t, tRich, formatNumber } = useI18n();
  const settings = useAssistantSettings(orgId);
  const setFlag = useSetAssistantFlag(orgId);
  const [failed, setFailed] = useState<{ field: "assistant" | "chat"; error: unknown } | null>(
    null,
  );
  const link = patientChatUrl(window.location.origin, slug);

  const data = settings.data;
  const enabled = data?.assistantEnabled ?? false;
  const canEnable = ai ? canEnableAssistant(ai, now) : false;

  function toggle(field: "assistant" | "chat", checked: boolean) {
    setFailed(null);
    setFlag.mutate(
      field === "assistant" ? { assistant_enabled: checked } : { public_chat_enabled: checked },
      { onError: (error) => setFailed({ field, error }) },
    );
  }

  const assistantReason = !canEdit
    ? t("assistant.managersOnly")
    : enabled
      ? t("assistant.enabledHint")
      : !ai
        ? t("assistant.enableUnknown")
        : !ai.configured
          ? t("assistant.enableNeedsConfig")
          : !canEnable
            ? t("assistant.enableNeedsTest", { days: formatNumber(TEST_VALID_DAYS) })
            : t("assistant.enableReady");

  const failureText = (error: unknown) =>
    describeError(error).code === "assistant_not_tested"
      ? t("assistant.notTestedError", { days: formatNumber(TEST_VALID_DAYS) })
      : errorText(t, error);

  return (
    <Card as="section" aria-labelledby="assistant-activation-title">
      <CardHeader
        title={<span id="assistant-activation-title">{t("assistant.activationTitle")}</span>}
        description={t("assistant.activationDescription")}
      />
      <CardBody className="flex flex-col gap-5">
        {settings.isPending ? (
          <SkeletonText lines={4} />
        ) : settings.error ? (
          <QueryError error={settings.error} onRetry={() => void settings.refetch()} />
        ) : !data ? (
          <Alert tone="error">{t("assistant.settingsMissing")}</Alert>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <Switch
                checked={enabled}
                busy={setFlag.isPending && "assistant_enabled" in (setFlag.variables ?? {})}
                disabled={!canEdit || (!enabled && !canEnable)}
                onCheckedChange={(checked) => toggle("assistant", checked)}
                label={t("assistant.enableLabel")}
                description={assistantReason}
              />
              {failed?.field === "assistant" && (
                <Alert tone="error">
                  {failureText(failed.error)}
                  {errorReference(failed.error) && (
                    <span className="mt-1 block text-xs opacity-80">
                      {t("errors.reference", { id: errorReference(failed.error) ?? "" })}
                    </span>
                  )}
                </Alert>
              )}
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-100 pt-5">
              <Switch
                checked={data.publicChatEnabled}
                busy={setFlag.isPending && "public_chat_enabled" in (setFlag.variables ?? {})}
                disabled={!canEdit}
                onCheckedChange={(checked) => toggle("chat", checked)}
                label={t("assistant.publicChatLabel")}
                description={canEdit ? t("assistant.publicChatHint") : t("assistant.managersOnly")}
              />
              {failed?.field === "chat" && <Alert tone="error">{failureText(failed.error)}</Alert>}

              <div className="flex flex-col gap-1.5">
                <label htmlFor="patient-chat-link" className="text-sm font-bold text-slate-800">
                  {t("assistant.patientLink")}
                </label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    id="patient-chat-link"
                    dir="ltr"
                    readOnly
                    value={link}
                    onFocus={(event) => event.currentTarget.select()}
                    className="font-mono text-sm sm:text-base"
                    aria-describedby="patient-chat-link-hint"
                  />
                  <div className="flex shrink-0 gap-2">
                    <CopyButton value={link} label={t("assistant.copyPatientLink")} />
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={buttonClasses({ variant: "outline", size: "sm" })}
                    >
                      <ExternalLink className="size-4" aria-hidden="true" />
                      {t("assistant.openLink")}
                      <span className="sr-only">{t("common.opensInNewTab")}</span>
                    </a>
                  </div>
                </div>
                <p
                  id="patient-chat-link-hint"
                  className="text-[0.8125rem] leading-relaxed text-slate-600"
                >
                  {data.publicChatEnabled
                    ? t("assistant.patientLinkOn")
                    : tRich("assistant.patientLinkOff", {
                        strong: <strong>{t("assistant.publicChatLabel")}</strong>,
                      })}
                </p>
              </div>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}
