import type { ComponentType, ReactNode, SVGProps } from "react";
import {
  CalendarCheck,
  CalendarPlus,
  ChevronRight,
  Inbox,
  MessagesSquare,
  Timer,
} from "lucide-react";
import { Link } from "react-router";
import { Card, CardBody, CardHeader, StatTile } from "@/components/ui";
import { QueryError } from "@/components/layout/QueryError";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/cn";
import { ChannelSplit } from "./ChannelSplit";
import { DailyConversationsChart } from "./DailyConversationsChart";
import { fillDailySeries, formatResponseTime, type Period } from "./metrics";
import { PeriodSelector } from "./PeriodSelector";
import type { useDashboardMetrics } from "./queries";

function NoData() {
  const { t } = useI18n();
  return <span className="text-base font-bold text-slate-500">{t("dashboard.noData")}</span>;
}

/** A stat tile that opens a page (the whole tile is the link). */
function LinkTile({
  to,
  label,
  value,
  hint,
  icon,
  loading,
}: {
  to: string;
  label: ReactNode;
  value: ReactNode;
  hint: ReactNode;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  loading: boolean;
}) {
  return (
    <Link
      to={to}
      className="group block rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <StatTile
        label={label}
        value={value}
        icon={icon}
        loading={loading}
        className="h-full transition-colors group-hover:border-primary/40"
        hint={
          <span className="inline-flex items-center gap-1 font-bold text-primary">
            {hint}
            <ChevronRight className="flip-rtl size-3.5" aria-hidden="true" />
          </span>
        }
      />
    </Link>
  );
}

export function MetricsSection({
  query,
  days,
  onDaysChange,
}: {
  query: ReturnType<typeof useDashboardMetrics>;
  days: Period;
  onDaysChange: (days: Period) => void;
}) {
  const { t, formatNumber } = useI18n();
  const metrics = query.data;
  const loading = query.isPending;
  const busy = query.isPlaceholderData && query.isFetching;
  const n = (value: number | undefined) => formatNumber(value ?? 0);
  const responseTime = (value: number | null | undefined) =>
    formatResponseTime(value, t, formatNumber) ?? <NoData />;
  const responded = metrics?.respondedConversations ?? 0;
  const responseHint =
    responded > 0
      ? t("dashboard.responseHint", { n: formatNumber(responded) })
      : t("dashboard.responseHintNone");

  return (
    <section aria-labelledby="metrics-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="metrics-title" className="text-lg font-extrabold text-slate-900">
            {t("dashboard.metricsTitle")}
          </h2>
          <p className="text-sm text-slate-600">{t("dashboard.metricsDescription")}</p>
        </div>
        <PeriodSelector value={days} onChange={onDaysChange} />
      </div>

      {query.error && !metrics ? (
        <QueryError error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <>
          {query.error && <QueryError error={query.error} onRetry={() => void query.refetch()} />}
          <div
            className={cn(
              "grid grid-cols-1 gap-3 transition-opacity min-[400px]:grid-cols-2 lg:grid-cols-3",
              busy && "opacity-55",
            )}
            aria-busy={busy || loading || undefined}
          >
            <StatTile
              label={t("dashboard.totalConversations")}
              value={n(metrics?.totalConversations)}
              hint={t("dashboard.totalConversationsHint")}
              icon={MessagesSquare}
              loading={loading}
            />
            <LinkTile
              to="/app/conversations?tab=needs_reply"
              label={t("dashboard.unanswered")}
              value={n(metrics?.unansweredConversations)}
              hint={t("dashboard.unansweredHint")}
              icon={Inbox}
              loading={loading}
            />
            <LinkTile
              to="/app/appointments?status=new"
              label={t("dashboard.appointmentRequests")}
              value={n(metrics?.appointmentRequests)}
              hint={t("dashboard.appointmentRequestsHint", {
                n: n(metrics?.newAppointmentRequests),
              })}
              icon={CalendarPlus}
              loading={loading}
            />
            <StatTile
              label={t("dashboard.confirmedAppointments")}
              value={n(metrics?.confirmedAppointments)}
              hint={t("dashboard.confirmedAppointmentsHint")}
              icon={CalendarCheck}
              loading={loading}
            />
            <StatTile
              label={t("dashboard.avgResponse")}
              value={responseTime(metrics?.avgFirstResponseSeconds)}
              hint={responseHint}
              icon={Timer}
              loading={loading}
            />
            <StatTile
              label={t("dashboard.medianResponse")}
              value={responseTime(metrics?.medianFirstResponseSeconds)}
              hint={t("dashboard.medianResponseHint")}
              icon={Timer}
              loading={loading}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card as="section" aria-labelledby="daily-title" className="lg:col-span-2">
              <CardHeader
                title={<span id="daily-title">{t("dashboard.chartTitle")}</span>}
                description={t("dashboard.chartDescription")}
              />
              <CardBody>
                {metrics ? (
                  <DailyConversationsChart
                    points={fillDailySeries(metrics.daily, metrics.since, days)}
                    busy={busy}
                  />
                ) : (
                  <div className="h-[228px] animate-pulse rounded-xl bg-slate-100" />
                )}
              </CardBody>
            </Card>
            <Card as="section" aria-labelledby="channel-title">
              <CardHeader
                title={<span id="channel-title">{t("dashboard.channelTitle")}</span>}
                description={t("dashboard.channelDescription")}
              />
              <CardBody>
                {metrics ? (
                  <ChannelSplit
                    web={metrics.byChannel.web}
                    whatsapp={metrics.byChannel.whatsapp}
                    busy={busy}
                  />
                ) : (
                  <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
                )}
              </CardBody>
            </Card>
          </div>
        </>
      )}
    </section>
  );
}
