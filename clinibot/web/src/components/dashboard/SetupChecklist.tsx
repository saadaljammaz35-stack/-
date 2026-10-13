import { ArrowRight, CircleCheck, CircleDashed, CircleHelp } from "lucide-react";
import { Link } from "react-router";
import { Card, CardBody, CardHeader, Skeleton } from "@/components/ui";
import { QueryError } from "@/components/layout/QueryError";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/cn";
import { setupProgress, type SetupItem } from "./setup";
import type { SetupItemsState } from "./useSetupItems";

function ItemIcon({ state }: { state: SetupItem["state"] }) {
  if (state === "done")
    return <CircleCheck className="size-6 shrink-0 text-accent-strong" aria-hidden="true" />;
  if (state === "unknown")
    return <CircleHelp className="size-6 shrink-0 text-slate-400" aria-hidden="true" />;
  return <CircleDashed className="size-6 shrink-0 text-slate-400" aria-hidden="true" />;
}

export function SetupChecklist({ setup }: { setup: SetupItemsState }) {
  const { t, formatNumber } = useI18n();
  const { items, loading, failures, retry } = setup;
  const progress = setupProgress(items);
  const stateLabel = {
    done: t("dashboard.setupDone"),
    todo: t("dashboard.setupTodo"),
    unknown: t("dashboard.setupUnknown"),
  } as const;

  return (
    <Card as="section" id="setup" aria-labelledby="setup-title" className="scroll-mt-24">
      <CardHeader
        title={<span id="setup-title">{t("dashboard.setupTitle")}</span>}
        description={
          loading
            ? t("dashboard.setupChecking")
            : t("dashboard.setupProgress", {
                done: formatNumber(progress.done),
                total: formatNumber(progress.total),
              })
        }
      />
      <CardBody className="flex flex-col gap-4">
        {!loading && (
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-slate-100"
            role="progressbar"
            aria-label={t("dashboard.setupTitle")}
            aria-valuemin={0}
            aria-valuemax={progress.total}
            aria-valuenow={progress.done}
          >
            <div
              className="h-full rounded-full bg-accent-strong transition-[width]"
              style={{ width: `${(progress.done / progress.total) * 100}%` }}
            />
          </div>
        )}
        {failures.length > 0 && <QueryError error={failures[0]?.error} onRetry={retry} />}
        <ul className="flex flex-col divide-y divide-slate-100">
          {items.map((item) => (
            <li key={item.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                {loading && item.state === "unknown" ? (
                  <Skeleton className="size-6 shrink-0 rounded-full" />
                ) : (
                  <ItemIcon state={item.state} />
                )}
                <div className="min-w-0">
                  <p
                    className={cn(
                      "text-sm font-bold",
                      item.state === "done" ? "text-slate-600" : "text-slate-900",
                    )}
                  >
                    {t(item.title)}
                    <span className="sr-only">
                      {" "}
                      (
                      {loading && item.state === "unknown"
                        ? t("common.loading")
                        : stateLabel[item.state]}
                      )
                    </span>
                  </p>
                  {item.state !== "done" && (
                    <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-slate-600">
                      {item.state === "unknown" && !loading
                        ? t("dashboard.setupUnknownText")
                        : t(item.text)}
                    </p>
                  )}
                </div>
              </div>
              {item.state !== "done" && (
                <Link
                  to={item.to}
                  className="inline-flex min-h-11 shrink-0 items-center gap-1.5 self-start rounded-xl px-3 text-sm font-bold text-primary hover:bg-primary-soft sm:self-center"
                >
                  {t(item.action)}
                  <ArrowRight className="flip-rtl size-4" aria-hidden="true" />
                </Link>
              )}
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
