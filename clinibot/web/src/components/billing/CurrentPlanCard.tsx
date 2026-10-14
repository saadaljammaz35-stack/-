import { Users } from "lucide-react";
import { QueryError } from "@/components/layout/QueryError";
import {
  Alert,
  Badge,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  Skeleton,
  type BadgeTone,
} from "@/components/ui";
import { useI18n, type MessageKey } from "@/i18n";
import {
  TRIAL_AI_REPLY_CAP,
  daysLeft,
  planName,
  planState,
  type Entitlements,
  type PlanId,
  type PlanState,
  type SubscriptionStatus,
} from "./model";
import { UsageMeter } from "./UsageMeter";

export interface PlanRow {
  plan: PlanId;
  name_ar: string;
  name_en: string;
  monthly_price_sar: number;
  ai_replies_per_month: number;
  seats: number;
}

export interface SubscriptionRow {
  plan: PlanId;
  status: SubscriptionStatus;
  trial_ends_at: string | null;
  current_period_end: string | null;
}

const STATE_LABELS: Record<PlanState, MessageKey> = {
  none: "billing.state_none",
  trial: "billing.state_trial",
  trial_ended: "billing.state_trial_ended",
  active: "billing.state_active",
  past_due: "billing.state_past_due",
  cancelled: "billing.state_cancelled",
  expired: "billing.state_expired",
};

const STATE_TONES: Record<PlanState, BadgeTone> = {
  none: "neutral",
  trial: "info",
  trial_ended: "danger",
  active: "success",
  past_due: "warning",
  cancelled: "danger",
  expired: "danger",
};

interface CurrentPlanCardProps {
  entitlements: { data: Entitlements | undefined; error: unknown; refetch: () => void };
  subscription: SubscriptionRow | null | undefined;
  plans: readonly PlanRow[] | undefined;
  loading: boolean;
  now?: Date;
}

export function CurrentPlanCard({
  entitlements,
  subscription,
  plans,
  loading,
  now = new Date(),
}: CurrentPlanCardProps) {
  const { t, lang, formatDate, formatNumber } = useI18n();

  if (entitlements.error) {
    return <QueryError error={entitlements.error} onRetry={entitlements.refetch} />;
  }

  const ent = entitlements.data;
  const status = subscription?.status ?? ent?.status ?? null;
  const planId = subscription?.plan ?? ent?.plan ?? null;
  const trialEndsAt = subscription?.trial_ends_at ?? ent?.trialEndsAt ?? null;
  const periodEnd = subscription?.current_period_end ?? ent?.currentPeriodEnd ?? null;
  const state = planState(status, trialEndsAt, now);
  const plan = planId ? plans?.find((item) => item.plan === planId) : undefined;
  const left = daysLeft(trialEndsAt, now);
  const inactive =
    state === "cancelled" ||
    state === "expired" ||
    ((state === "active" || state === "past_due") && ent?.isActive === false);
  const trialCapped =
    status === "trialing" &&
    plan !== undefined &&
    ent !== undefined &&
    ent.aiRepliesLimit < plan.ai_replies_per_month;

  return (
    <Card as="section" aria-labelledby="current-plan-title" aria-busy={loading || undefined}>
      <CardHeader
        title={<span id="current-plan-title">{t("billing.currentTitle")}</span>}
        actions={
          !loading && (
            <Badge tone={STATE_TONES[state]} dot>
              {t(STATE_LABELS[state])}
            </Badge>
          )
        }
      />
      <CardBody className="flex flex-col gap-5">
        {loading || !ent ? (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
              <div className="min-w-0">
                <p className="text-sm text-slate-600">{t("billing.planLabel")}</p>
                <p className="text-2xl font-extrabold text-slate-900">
                  {plan ? planName(plan, lang) : planId ? t(`audit.plan_${planId}`) : "—"}
                </p>
                {state === "trial" && trialEndsAt && (
                  <p className="mt-1 text-sm text-slate-700">
                    {t("billing.trialEnds", { date: formatDate(trialEndsAt) })}
                  </p>
                )}
                {(state === "active" || state === "past_due") && periodEnd && (
                  <p className="mt-1 text-sm text-slate-700">
                    {t("billing.periodEnds", { date: formatDate(periodEnd) })}
                  </p>
                )}
              </div>
              {state === "trial" && left !== null && (
                <p className="rounded-xl bg-sky-50 px-3 py-2 text-sm font-bold text-sky-900 ring-1 ring-sky-200 ring-inset">
                  {t("billing.daysLeft", { count: formatNumber(left) })}
                </p>
              )}
            </div>

            {state === "none" && <Alert tone="warning">{t("billing.noSubscriptionText")}</Alert>}
            {state === "trial_ended" && (
              <Alert tone="warning">
                {t("billing.trialEndedText", {
                  date: trialEndsAt ? formatDate(trialEndsAt) : "—",
                })}
              </Alert>
            )}
            {state === "past_due" && !inactive && (
              <Alert tone="warning">{t("billing.pastDueText")}</Alert>
            )}
            {inactive && <Alert tone="warning">{t("billing.inactiveText")}</Alert>}

            <div className="grid gap-6 md:grid-cols-2">
              <UsageMeter
                label={t("billing.aiUsageLabel")}
                used={ent.aiRepliesUsed}
                limit={ent.aiRepliesLimit}
              >
                <p className="text-[0.8125rem] leading-relaxed text-slate-600">
                  {t("billing.aiUsageHint")}
                </p>
                {trialCapped && (
                  <p className="text-[0.8125rem] leading-relaxed text-slate-600">
                    {t("billing.trialCapNote", { cap: formatNumber(TRIAL_AI_REPLY_CAP) })}
                  </p>
                )}
                {ent.aiRepliesLimit > 0 && ent.aiRepliesUsed >= ent.aiRepliesLimit ? (
                  <p className="text-[0.8125rem] font-bold text-red-700">
                    {t("billing.aiUsageFull")}
                  </p>
                ) : ent.aiRepliesLimit > 0 && ent.aiRepliesUsed >= ent.aiRepliesLimit * 0.8 ? (
                  <p className="text-[0.8125rem] font-bold text-amber-800">
                    {t("billing.aiUsageHigh")}
                  </p>
                ) : null}
              </UsageMeter>
              <UsageMeter
                label={t("billing.seatsLabel")}
                used={ent.seatsUsed}
                limit={ent.seatsLimit}
              >
                {ent.seatsLimit === null && (
                  <p className="text-[0.8125rem] text-slate-600">{t("billing.seatsUnknown")}</p>
                )}
                <div>
                  <ButtonLink
                    to="/app/staff"
                    variant="outline"
                    size="sm"
                    icon={<Users className="size-4" aria-hidden="true" />}
                  >
                    {t("billing.manageTeam")}
                  </ButtonLink>
                </div>
              </UsageMeter>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}
