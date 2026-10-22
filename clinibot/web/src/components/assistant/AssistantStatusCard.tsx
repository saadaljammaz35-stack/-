import { RefreshCw } from "lucide-react";
import {
  Alert,
  Badge,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  SkeletonText,
} from "@/components/ui";
import { QueryError } from "@/components/layout/QueryError";
import { useI18n } from "@/i18n";
import { ASSISTANT_STATE_VIEW, assistantState, type SystemStatus } from "./model";

export interface AssistantStatusCardProps {
  status: SystemStatus | undefined;
  loading: boolean;
  error: unknown;
  refreshing: boolean;
  onRefresh: () => void;
  now: Date;
}

/** What the server reports about the assistant: configured, tested, switched on. */
export function AssistantStatusCard({
  status,
  loading,
  error,
  refreshing,
  onRefresh,
  now,
}: AssistantStatusCardProps) {
  const { t, formatDate, formatNumber } = useI18n();
  const ai = status?.ai;
  const entitlements = status?.entitlements ?? null;
  const state = ai ? assistantState(ai, entitlements, now) : null;
  const view = state ? ASSISTANT_STATE_VIEW[state] : null;

  return (
    <Card as="section" aria-labelledby="assistant-status-title" aria-busy={loading || undefined}>
      <CardHeader
        title={<span id="assistant-status-title">{t("assistant.statusTitle")}</span>}
        actions={
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="inline-flex size-11 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
            aria-label={t("assistant.refreshStatus")}
            title={t("assistant.refreshStatus")}
          >
            <RefreshCw
              className={refreshing ? "size-5 animate-spin" : "size-5"}
              aria-hidden="true"
            />
          </button>
        }
      />
      <CardBody className="flex flex-col gap-4">
        {loading ? (
          <SkeletonText lines={4} />
        ) : error ? (
          <QueryError error={error} onRetry={onRefresh} retrying={refreshing} />
        ) : ai && view ? (
          <>
            <div aria-live="polite">
              <Badge tone={view.tone} dot className="text-sm">
                {t(view.label)}
              </Badge>
              <p className="mt-2 text-sm leading-relaxed text-slate-700">{t(view.text)}</p>
            </div>

            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">{t("assistant.statusModel")}</dt>
                <dd className="mt-0.5 font-bold break-all text-slate-900">
                  {ai.model ? <span dir="ltr">{ai.model}</span> : t("assistant.unknown")}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">{t("assistant.statusEnabled")}</dt>
                <dd className="mt-0.5 font-bold text-slate-900">
                  {ai.enabled ? t("assistant.switchedOn") : t("assistant.switchedOff")}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">{t("assistant.statusLastTest")}</dt>
                <dd className="mt-0.5 font-bold text-slate-900">
                  {ai.lastTestAt
                    ? formatDate(ai.lastTestAt, { dateStyle: "medium", timeStyle: "short" })
                    : t("assistant.neverTested")}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">{t("assistant.statusLastResult")}</dt>
                <dd className="mt-0.5">
                  {ai.lastTestOk === true ? (
                    <Badge tone="success">{t("assistant.testPassed")}</Badge>
                  ) : ai.lastTestOk === false ? (
                    <Badge tone="danger">{t("assistant.testFailedShort")}</Badge>
                  ) : (
                    <span className="font-bold text-slate-900">{t("assistant.noResult")}</span>
                  )}
                </dd>
              </div>
              {entitlements?.aiLimit !== null && entitlements?.aiLimit !== undefined && (
                <div className="sm:col-span-2">
                  <dt className="text-slate-500">{t("assistant.statusUsage")}</dt>
                  <dd className="mt-0.5 font-bold text-slate-900">
                    {t("assistant.usageValue", {
                      used: formatNumber(entitlements.aiUsed ?? 0),
                      limit: formatNumber(entitlements.aiLimit),
                    })}
                  </dd>
                </div>
              )}
            </dl>

            {entitlements && !entitlements.isActive && (
              <Alert
                tone="warning"
                title={t("assistant.subscriptionInactiveTitle")}
                action={
                  <ButtonLink to="/app/billing" size="sm" variant="outline">
                    {t("assistant.goToBilling")}
                  </ButtonLink>
                }
              >
                {t("assistant.subscriptionInactiveText")}
              </Alert>
            )}
            {entitlements?.isActive && entitlements.aiRemaining === 0 && (
              <Alert
                tone="warning"
                title={t("assistant.quotaExhaustedTitle")}
                action={
                  <ButtonLink to="/app/billing" size="sm" variant="outline">
                    {t("assistant.goToBilling")}
                  </ButtonLink>
                }
              >
                {t("assistant.quotaExhaustedText")}
              </Alert>
            )}
          </>
        ) : null}
      </CardBody>
    </Card>
  );
}
