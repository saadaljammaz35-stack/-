import { Bot, CircleCheck, Users } from "lucide-react";
import { QueryError } from "@/components/layout/QueryError";
import { Badge, Card, CardBody, CardHeader, EmptyState, Skeleton } from "@/components/ui";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/cn";
import type { PlanRow } from "./CurrentPlanCard";
import { planName, type PlanId } from "./model";

interface PlansGridProps {
  plans: readonly PlanRow[] | undefined;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  currentPlan: PlanId | null;
}

/** The published plans (plan_limits). Information only: there is no checkout. */
export function PlansGrid({ plans, loading, error, onRetry, currentPlan }: PlansGridProps) {
  const { t, lang, formatNumber, formatSar } = useI18n();

  return (
    <Card as="section" aria-labelledby="plans-title">
      <CardHeader
        title={<span id="plans-title">{t("billing.plansTitle")}</span>}
        description={t("billing.plansDescription")}
      />
      <CardBody>
        {error ? (
          <QueryError error={error} onRetry={onRetry} />
        ) : loading || !plans ? (
          <div className="grid gap-4 md:grid-cols-3" aria-hidden="true">
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} className="h-44 w-full rounded-2xl" />
            ))}
          </div>
        ) : plans.length === 0 ? (
          <EmptyState title={t("billing.plansEmpty")} className="py-6" />
        ) : (
          <ul className="grid gap-4 md:grid-cols-3">
            {plans.map((plan) => {
              const current = plan.plan === currentPlan;
              return (
                <li
                  key={plan.plan}
                  className={cn(
                    "flex flex-col rounded-2xl border p-5",
                    current
                      ? "border-primary bg-primary-soft ring-1 ring-primary ring-inset"
                      : "border-slate-200 bg-white",
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-lg font-extrabold text-slate-900">
                      {planName(plan, lang)}
                    </h3>
                    {current && (
                      <Badge
                        tone="brand"
                        icon={<CircleCheck className="size-3.5" aria-hidden="true" />}
                      >
                        {t("billing.currentBadge")}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-3 flex flex-wrap items-baseline gap-x-1.5">
                    <span className="text-2xl font-extrabold text-slate-900 tabular-nums">
                      {formatSar(plan.monthly_price_sar)}
                    </span>
                    <span className="text-sm text-slate-600">{t("billing.perMonth")}</span>
                  </p>
                  <p className="text-xs text-slate-500">{t("billing.exclVat")}</p>
                  <dl className="mt-4 flex flex-col gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Bot className="size-4 shrink-0 text-primary" aria-hidden="true" />
                      <dt className="text-slate-600">{t("billing.planAiReplies")}:</dt>
                      <dd className="font-bold text-slate-900 tabular-nums">
                        {formatNumber(plan.ai_replies_per_month)}
                      </dd>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="size-4 shrink-0 text-primary" aria-hidden="true" />
                      <dt className="text-slate-600">{t("billing.planSeats")}:</dt>
                      <dd className="font-bold text-slate-900 tabular-nums">
                        {formatNumber(plan.seats)}
                      </dd>
                    </div>
                  </dl>
                </li>
              );
            })}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
