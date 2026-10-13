import { useQuery } from "@tanstack/react-query";
import { Bot, Info, UsersRound } from "lucide-react";
import { Link } from "react-router";
import { QueryError } from "@/components/layout/QueryError";
import { Skeleton } from "@/components/ui";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/cn";
import { revealStyle } from "./motion";
import { fetchPlans, planName, PLANS_QUERY_KEY, type Plan } from "./pricing";
import { Reveal } from "./Reveal";
import { Section, SectionHeading } from "./Section";
import { container, mkButton } from "./styles";

export function Pricing() {
  const { t } = useI18n();
  const query = useQuery({
    queryKey: PLANS_QUERY_KEY,
    queryFn: fetchPlans,
    staleTime: 10 * 60_000,
  });

  return (
    <Section id="pricing" labelledBy="pricing-title" className="py-16 sm:py-24">
      <div className={container}>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading
            id="pricing-title"
            kicker={t("marketing.pricingKicker")}
            title={t("marketing.pricingTitle")}
            intro={t("marketing.pricingNote")}
          />
          <p className="inline-flex w-fit shrink-0 items-center gap-2.5 rounded-full bg-mint px-4 py-2 text-sm font-bold text-accent-strong">
            <span className="relative flex size-2.5" aria-hidden="true">
              <span className="mk-live mk-live--pulse absolute inset-0 rounded-full bg-accent" />
              <span className="relative size-2.5 rounded-full bg-accent" />
            </span>
            {t("marketing.pricingTrial")}
          </p>
        </div>

        <div className="mt-10" aria-busy={query.isPending || undefined}>
          {query.isPending ? (
            <PlansSkeleton />
          ) : query.error ? (
            <QueryError
              error={query.error}
              onRetry={() => void query.refetch()}
              retrying={query.isFetching}
            />
          ) : query.data.length === 0 ? (
            <p className="flex items-start gap-3 rounded-2xl bg-white/80 p-5 text-slate-700 ring-1 ring-slate-200">
              <Info className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
              {t("marketing.pricingEmpty")}
            </p>
          ) : (
            <PlanList plans={query.data} />
          )}
        </div>

        <ul className="mt-8 flex flex-col gap-2 text-sm leading-relaxed text-slate-600">
          <li className="flex gap-2">
            <Info className="mt-0.5 size-4 shrink-0 text-slate-500" aria-hidden="true" />
            {t("marketing.pricingTrialLimit")}
          </li>
          <li className="flex gap-2">
            <Info className="mt-0.5 size-4 shrink-0 text-slate-500" aria-hidden="true" />
            {t("marketing.pricingMetaFees")}
          </li>
        </ul>
      </div>
    </Section>
  );
}

function PlanList({ plans }: { plans: Plan[] }) {
  const { t, lang, formatNumber, formatSar } = useI18n();
  return (
    <Reveal
      as="ul"
      items={plans.length}
      className={cn("grid gap-5", plans.length >= 3 ? "md:grid-cols-3" : "md:grid-cols-2")}
    >
      {plans.map((plan, index) => {
        const nameId = `plan-${plan.plan}`;
        return (
          <li
            key={plan.plan}
            data-reveal=""
            style={revealStyle(index)}
            className="flex flex-col rounded-3xl bg-white p-6 shadow-card ring-1 ring-slate-200"
          >
            <h3 id={nameId} className="text-lg font-bold text-slate-900">
              {planName(plan, lang)}
            </h3>
            <p className="mt-4 flex flex-wrap items-baseline gap-x-2">
              <span className="text-4xl font-extrabold text-primary">
                {formatSar(plan.monthlyPriceSar)}
              </span>
              <span className="text-base font-medium text-slate-600">
                {t("marketing.pricingPerMonth")}
              </span>
            </p>
            <p className="mt-1 text-sm text-slate-600">{t("marketing.pricingExVat")}</p>

            <dl className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-5">
              <div className="flex items-center gap-3">
                <Bot className="size-5 shrink-0 text-accent-strong" aria-hidden="true" />
                <dt className="flex-1 text-slate-700">{t("marketing.pricingAiReplies")}</dt>
                <dd className="font-bold text-slate-900">{formatNumber(plan.aiRepliesPerMonth)}</dd>
              </div>
              <div className="flex items-center gap-3">
                <UsersRound className="size-5 shrink-0 text-accent-strong" aria-hidden="true" />
                <dt className="flex-1 text-slate-700">{t("marketing.pricingSeats")}</dt>
                <dd className="font-bold text-slate-900">{formatNumber(plan.seats)}</dd>
              </div>
            </dl>

            <Link to="/register" className={mkButton("navy", "md", "mt-6 w-full")}>
              {t("marketing.pricingCta")}
            </Link>
          </li>
        );
      })}
    </Reveal>
  );
}

function PlansSkeleton() {
  const { t } = useI18n();
  return (
    <div role="status">
      <span className="sr-only">{t("marketing.pricingLoading")}</span>
      <div className="grid gap-5 md:grid-cols-3" aria-hidden="true">
        {[0, 1, 2].map((key) => (
          <div
            key={key}
            className="flex flex-col gap-4 rounded-3xl bg-white/80 p-6 ring-1 ring-slate-200"
          >
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-10 w-36" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-4 h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="mt-4 h-11 w-full rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}
