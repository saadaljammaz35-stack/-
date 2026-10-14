import { CalendarPlus, UserRound } from "lucide-react";
import { Badge } from "@/components/ui";
import { useI18n } from "@/i18n";
import { localizedPair, type ServiceRow } from "@/components/knowledge/model";
import { handoffReasonLabel, OUTCOME_VIEW, timeWindowLabel, type TestResult } from "./model";

/** One assistant reply in the test console, with what the server reported about it. */
export function TestReply({
  result,
  services,
}: {
  result: TestResult;
  services: readonly ServiceRow[] | undefined;
}) {
  const { t, lang, formatDate, formatNumber } = useI18n();
  const outcome = OUTCOME_VIEW[result.outcome];
  const appointment = result.appointment;
  const service = appointment?.serviceId
    ? services?.find((item) => item.id === appointment.serviceId)
    : undefined;
  const windowKey = timeWindowLabel(appointment?.preferredTimeWindow ?? null);
  const noModelCall =
    result.usage.input === 0 && result.usage.output === 0 && result.usage.cacheRead === 0;

  return (
    <div className="flex flex-col gap-3">
      <p
        className="text-[0.9375rem] leading-relaxed break-words whitespace-pre-wrap text-slate-900"
        dir="auto"
      >
        {result.reply}
      </p>

      <div className="flex flex-col gap-1 border-t border-slate-100 pt-3">
        <div>
          <Badge tone={outcome.tone} dot>
            {t(outcome.label)}
          </Badge>
        </div>
        <p className="text-[0.8125rem] leading-relaxed text-slate-600">{t(outcome.text)}</p>
      </div>

      {result.handoff && (
        <div className="flex items-start gap-2 rounded-xl bg-sky-50 px-3 py-2.5 text-[0.8125rem] text-sky-950">
          <UserRound className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-bold">
              {t("assistant.handoffReason", {
                reason: t(handoffReasonLabel(result.handoff.reason)),
              })}
            </p>
            {result.handoff.summary && (
              <p className="mt-0.5 break-words" dir="auto">
                {result.handoff.summary}
              </p>
            )}
          </div>
        </div>
      )}

      {appointment && (
        <div className="rounded-xl border border-dashed border-emerald-300 bg-mint/60 px-3 py-2.5 text-[0.8125rem] text-emerald-950">
          <p className="flex items-center gap-2 font-bold">
            <CalendarPlus className="size-4 shrink-0" aria-hidden="true" />
            {t("assistant.appointmentTitle")}
          </p>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt className="text-emerald-900/80">{t("assistant.appointmentName")}</dt>
            <dd className="min-w-0 break-words" dir="auto">
              {appointment.customerName ?? t("assistant.notProvided")}
            </dd>
            <dt className="text-emerald-900/80">{t("assistant.appointmentService")}</dt>
            <dd className="min-w-0 break-words">
              {service
                ? localizedPair(service.name_ar, service.name_en, lang).primary
                : appointment.serviceId
                  ? t("assistant.unknownService")
                  : t("assistant.notProvided")}
            </dd>
            <dt className="text-emerald-900/80">{t("assistant.appointmentDate")}</dt>
            <dd>
              {appointment.preferredDate
                ? formatDate(appointment.preferredDate) || appointment.preferredDate
                : t("assistant.notProvided")}
            </dd>
            <dt className="text-emerald-900/80">{t("assistant.appointmentWindow")}</dt>
            <dd>{windowKey ? t(windowKey) : t("assistant.notProvided")}</dd>
          </dl>
          <p className="mt-2 text-emerald-900/80">{t("assistant.appointmentNotSaved")}</p>
        </div>
      )}

      <p className="text-xs leading-relaxed text-slate-500">
        {noModelCall
          ? t("assistant.noModelCall")
          : t("assistant.usageLine", {
              model: result.model ?? t("assistant.unknown"),
              input: formatNumber(result.usage.input),
              output: formatNumber(result.usage.output),
              cached: formatNumber(result.usage.cacheRead),
            })}
      </p>
    </div>
  );
}
