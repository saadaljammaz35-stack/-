import { useId, useState } from "react";
import { ChevronDown, Eye } from "lucide-react";
import { Link } from "react-router";
import { Badge, Button, Card, CardBody, Skeleton } from "@/components/ui";
import { QueryError } from "@/components/layout/QueryError";
import { useI18n, type MessageKey } from "@/i18n";
import { cn } from "@/lib/cn";
import { DAY_CODES, faqDisplay, formatServicePrice, localizedPair, type DayCode } from "./model";
import { useClinicInfo, useFaqs, useServices } from "./queries";

const DAY_LABELS: Record<DayCode, MessageKey> = {
  sat: "knowledge.daySat",
  sun: "knowledge.daySun",
  mon: "knowledge.dayMon",
  tue: "knowledge.dayTue",
  wed: "knowledge.dayWed",
  thu: "knowledge.dayThu",
  fri: "knowledge.dayFri",
};

/**
 * "What the assistant will see": the active services, prices, hours and FAQs
 * from the data loaded on this page. Clearly labelled as a preview; the
 * assistant itself reads the saved data at the start of every reply.
 */
export function KnowledgePreview({ orgId }: { orgId: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <Card as="section" aria-labelledby={`${panelId}-title`} className="mt-6">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4 sm:px-6">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id={`${panelId}-title`} className="text-base font-extrabold text-slate-900">
              {t("knowledge.previewTitle")}
            </h2>
            <Badge tone="brand" icon={<Eye className="size-3.5" aria-hidden="true" />}>
              {t("knowledge.previewBadge")}
            </Badge>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            {t("knowledge.previewDescription")}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
          trailingIcon={
            <ChevronDown
              className={cn("size-4 transition-transform", open && "rotate-180")}
              aria-hidden="true"
            />
          }
        >
          {open ? t("knowledge.previewHide") : t("knowledge.previewShow")}
        </Button>
      </div>
      <div id={panelId} hidden={!open}>
        {open && <PreviewBody orgId={orgId} />}
      </div>
    </Card>
  );
}

function PreviewBody({ orgId }: { orgId: string }) {
  const { t, tRich, lang, formatSar, formatNumber } = useI18n();
  const services = useServices(orgId);
  const faqs = useFaqs(orgId);
  const info = useClinicInfo(orgId);

  const activeServices = (services.data ?? []).filter((service) => service.is_active);
  const activeFaqs = (faqs.data ?? []).filter((faq) => faq.is_active);
  const hoursNote = info.data
    ? localizedPair(info.data.hoursNoteAr, info.data.hoursNoteEn, lang).primary
    : "";

  const sectionTitle = "mb-2 text-sm font-extrabold text-slate-900";

  return (
    <CardBody className="flex flex-col gap-6 border-t border-slate-100 bg-slate-50/60">
      <div>
        <h3 className={sectionTitle}>
          {t("knowledge.previewServices", { count: formatNumber(activeServices.length) })}
        </h3>
        {services.isPending ? (
          <Skeleton className="h-16 w-full" />
        ) : services.error ? (
          <QueryError error={services.error} onRetry={() => void services.refetch()} />
        ) : activeServices.length === 0 ? (
          <p className="text-sm text-slate-600">{t("knowledge.previewNoServices")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {activeServices.map((service) => {
              const name = localizedPair(service.name_ar, service.name_en, lang);
              const description = localizedPair(service.description_ar, service.description_en, lang);
              return (
                <li key={service.id} className="rounded-xl bg-white px-3.5 py-2.5 text-sm ring-1 ring-slate-200">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="font-bold break-words text-slate-900">{name.primary}</span>
                    <span className="text-slate-700">
                      {formatServicePrice(service, { t, formatSar })}
                      {service.duration_minutes !== null &&
                        ` · ${t("knowledge.durationMinutes", { minutes: formatNumber(service.duration_minutes) })}`}
                    </span>
                  </div>
                  {description.primary && (
                    <p className="mt-1 break-words whitespace-pre-line text-slate-600" dir="auto">
                      {description.primary}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div>
        <h3 className={sectionTitle}>{t("knowledge.previewHours")}</h3>
        {info.isPending ? (
          <Skeleton className="h-24 w-full" />
        ) : info.error ? (
          <QueryError error={info.error} onRetry={() => void info.refetch()} />
        ) : !info.data ? (
          <p className="text-sm text-slate-600">{t("knowledge.previewNoSettings")}</p>
        ) : (
          <>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-xl bg-white px-3.5 py-3 text-sm ring-1 ring-slate-200">
              {DAY_CODES.map((day) => {
                const ranges = info.data?.workingHours[day] ?? [];
                return (
                  <div key={day} className="contents">
                    <dt className="text-slate-600">{t(DAY_LABELS[day])}</dt>
                    <dd className="text-slate-900">
                      {ranges.length === 0 ? (
                        <span className="text-slate-500">{t("knowledge.previewClosed")}</span>
                      ) : (
                        <span dir="ltr" className="inline-block tabular-nums">
                          {ranges.map(([from, to]) => `${from}–${to}`).join(", ")}
                        </span>
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
            {hoursNote && (
              <p className="mt-2 text-sm break-words text-slate-700" dir="auto">
                {t("knowledge.previewHoursNote", { note: hoursNote })}
              </p>
            )}
            <ul className="mt-2 flex flex-col gap-1 text-sm text-slate-700">
              <li>
                {info.data.receptionPhone ? (
                  tRich("knowledge.previewReception", {
                    phone: <span dir="ltr">{info.data.receptionPhone}</span>,
                  })
                ) : (
                  t("knowledge.previewNoReception")
                )}
              </li>
              <li>
                {tRich("knowledge.previewEmergency", {
                  number: <span dir="ltr">{info.data.emergencyNumber}</span>,
                })}
              </li>
            </ul>
            <p className="mt-2 text-[0.8125rem] text-slate-600">
              {tRich("knowledge.previewSettingsLink", {
                link: (
                  <Link to="/app/settings" className="font-bold text-primary underline">
                    {t("knowledge.previewSettingsLinkText")}
                  </Link>
                ),
              })}
            </p>
          </>
        )}
      </div>

      <div>
        <h3 className={sectionTitle}>
          {t("knowledge.previewFaqs", { count: formatNumber(activeFaqs.length) })}
        </h3>
        {faqs.isPending ? (
          <Skeleton className="h-16 w-full" />
        ) : faqs.error ? (
          <QueryError error={faqs.error} onRetry={() => void faqs.refetch()} />
        ) : activeFaqs.length === 0 ? (
          <p className="text-sm text-slate-600">{t("knowledge.previewNoFaqs")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {activeFaqs.map((faq) => {
              const { question, answer } = faqDisplay(faq, lang);
              return (
                <li key={faq.id} className="rounded-xl bg-white px-3.5 py-2.5 text-sm ring-1 ring-slate-200">
                  <p className="font-bold break-words text-slate-900" dir="auto">
                    {question}
                  </p>
                  <p className="mt-1 break-words whitespace-pre-line text-slate-700" dir="auto">
                    {answer}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="text-[0.8125rem] leading-relaxed text-slate-600">{t("knowledge.previewFootnote")}</p>
    </CardBody>
  );
}
