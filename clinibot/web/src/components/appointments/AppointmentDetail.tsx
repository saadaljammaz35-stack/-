import { useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { ArrowLeft, CalendarX2, MessagesSquare, Phone, Trash2 } from "lucide-react";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  Field,
  PageHeader,
  Select,
  Skeleton,
  useToast,
} from "@/components/ui";
import { QueryError } from "@/components/layout/QueryError";
import { useI18n } from "@/i18n";
import { errorText } from "@/lib/errors";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import { canManage } from "@/org/roles";
import { useCurrentOrg } from "@/org/useOrg";
import { usePollInterval, useNow } from "@/components/dashboard/hooks";
import { memberName, memberNameMap, useOrgMembers } from "@/components/dashboard/members";
import { formatDateTime, formatRelativeTime } from "@/components/dashboard/time";
import { AppointmentStatusBadge, SourceBadge } from "./badges";
import { isTimeWindow, serviceName, TIME_WINDOW_LABELS, type AppointmentDetailRow } from "./model";
import { NotesCard } from "./NotesCard";
import { NotifyCard } from "./NotifyCard";
import {
  AppointmentChangedError,
  POLL_MS,
  useAppointment,
  useDeleteAppointment,
  useUpdateAppointment,
} from "./queries";
import { StatusCard } from "./StatusCard";

function BackLink() {
  const { t } = useI18n();
  const location = useLocation();
  return (
    <Link
      to={{ pathname: "/app/appointments", search: location.search }}
      className="-ms-2 inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-sm font-bold text-primary hover:bg-primary-soft"
    >
      <ArrowLeft className="flip-rtl size-4" aria-hidden="true" />
      {t("appointments.backToList")}
    </Link>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-0.5 py-2.5 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4">
      <dt className="text-[0.8125rem] text-slate-500">{label}</dt>
      <dd className="min-w-0 text-sm break-words text-slate-900">{children}</dd>
    </div>
  );
}

function DetailsCard({ request }: { request: AppointmentDetailRow }) {
  const { t, lang, formatDate } = useI18n();
  const timeWindow = isTimeWindow(request.preferred_time_window)
    ? request.preferred_time_window
    : "any";
  const service = serviceName(request.service, lang);
  return (
    <Card as="section" aria-labelledby="details-title">
      <CardHeader title={<span id="details-title">{t("appointments.detailsTitle")}</span>} />
      <CardBody className="py-2">
        <dl className="divide-y divide-slate-100">
          <Row label={t("appointments.fieldPhone")}>
            <a
              href={`tel:${request.customer_phone}`}
              dir="ltr"
              className="-my-2 inline-flex min-h-11 items-center gap-1.5 font-bold text-primary hover:underline"
            >
              <Phone className="size-4" aria-hidden="true" />
              {request.customer_phone}
            </a>
          </Row>
          <Row label={t("appointments.fieldService")}>
            {service || <span className="text-slate-500">{t("appointments.notSpecified")}</span>}
          </Row>
          <Row label={t("appointments.fieldPreferred")}>
            {request.preferred_date
              ? formatDate(request.preferred_date, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })
              : t("appointments.anyDay")}
            {" · "}
            {t(TIME_WINDOW_LABELS[timeWindow])}
          </Row>
          {request.scheduled_for && (
            <Row
              label={
                request.status === "confirmed"
                  ? t("appointments.fieldScheduled")
                  : t("appointments.fieldScheduledPast")
              }
            >
              <span className="font-bold">{formatDateTime(lang, request.scheduled_for)}</span>
            </Row>
          )}
          <Row label={t("appointments.fieldNotes")}>
            {request.customer_notes ? (
              <span className="whitespace-pre-wrap" dir="auto">
                {request.customer_notes}
              </span>
            ) : (
              <span className="text-slate-500">{t("appointments.noNotes")}</span>
            )}
          </Row>
          <Row label={t("appointments.fieldCreated")}>
            {formatDateTime(lang, request.created_at)}
          </Row>
          {request.confirmed_at && (
            <Row label={t("appointments.fieldConfirmedAt")}>
              {formatDateTime(lang, request.confirmed_at)}
            </Row>
          )}
          {request.completed_at && (
            <Row label={t("appointments.fieldCompletedAt")}>
              {formatDateTime(lang, request.completed_at)}
            </Row>
          )}
          {request.cancelled_at && (
            <Row label={t("appointments.fieldCancelledAt")}>
              {formatDateTime(lang, request.cancelled_at)}
            </Row>
          )}
        </dl>
      </CardBody>
    </Card>
  );
}

function AssignCard({
  orgId,
  request,
  members,
}: {
  orgId: string;
  request: AppointmentDetailRow;
  members: ReturnType<typeof useOrgMembers>;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const update = useUpdateAppointment(orgId, request.id);
  const known = members.data?.some((member) => member.user_id === request.assigned_to);
  return (
    <Card as="section" aria-labelledby="assign-title">
      <CardHeader title={<span id="assign-title">{t("appointments.assignTitle")}</span>} />
      <CardBody>
        {members.error ? (
          <QueryError error={members.error} onRetry={() => void members.refetch()} />
        ) : (
          <Field label={t("appointments.assignLabel")} hideLabel>
            <Select
              value={request.assigned_to ?? ""}
              disabled={members.isPending || update.isPending}
              onChange={(event) => {
                const value = event.target.value || null;
                update.mutate(
                  { patch: { assigned_to: value } },
                  {
                    onSuccess: () =>
                      toast.success(
                        t(value ? "appointments.toastAssigned" : "appointments.toastUnassigned"),
                      ),
                    onError: (error) =>
                      toast.error(
                        error instanceof AppointmentChangedError
                          ? t("appointments.errorChanged")
                          : errorText(t, error),
                      ),
                  },
                );
              }}
            >
              <option value="">{t("appointments.unassigned")}</option>
              {request.assigned_to && !known && !members.isPending && (
                <option value={request.assigned_to}>{t("appointments.formerMember")}</option>
              )}
              {members.data?.map((member) => (
                <option key={member.user_id} value={member.user_id}>
                  {memberName(member)}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </CardBody>
    </Card>
  );
}

function SourceCard({
  request,
  names,
}: {
  request: AppointmentDetailRow;
  names: Map<string, string>;
}) {
  const { t } = useI18n();
  return (
    <Card as="section" aria-labelledby="source-title">
      <CardHeader title={<span id="source-title">{t("appointments.sourceTitle")}</span>} />
      <CardBody className="flex flex-col gap-3 text-sm text-slate-700">
        <div>
          <SourceBadge source={request.source} />
        </div>
        {request.source === "dashboard" && (
          <p>
            {t("appointments.createdBy", {
              name: request.created_by
                ? (names.get(request.created_by) ?? t("appointments.formerMember"))
                : t("appointments.formerMember"),
            })}
          </p>
        )}
        {request.conversation ? (
          <Link
            to={`/app/conversations/${request.conversation.id}`}
            className="inline-flex min-h-11 items-center gap-2 self-start rounded-xl font-bold text-primary hover:underline"
          >
            <MessagesSquare className="size-4" aria-hidden="true" />
            {t("appointments.openConversation")}
          </Link>
        ) : request.source !== "dashboard" ? (
          <p className="text-slate-500">{t("appointments.conversationGone")}</p>
        ) : null}
      </CardBody>
    </Card>
  );
}

function DeleteCard({ orgId, request }: { orgId: string; request: AppointmentDetailRow }) {
  const { t } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const remove = useDeleteAppointment(orgId, request.id);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setError(null);
    try {
      await remove.mutateAsync();
      setOpen(false);
      toast.success(t("appointments.toastDeleted"));
      void navigate({ pathname: "/app/appointments", search: location.search }, { replace: true });
    } catch (failure) {
      setError(errorText(t, failure));
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        className="self-start text-red-700 hover:bg-red-50"
        icon={<Trash2 className="size-4" aria-hidden="true" />}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        {t("appointments.delete")}
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={confirm}
        title={t("appointments.deleteTitle")}
        description={t("appointments.deleteText")}
        confirmLabel={t("appointments.deleteConfirm")}
        error={error}
      />
    </>
  );
}

export function AppointmentDetail() {
  const { t, lang } = useI18n();
  const org = useCurrentOrg();
  const { id = "" } = useParams();
  const poll = usePollInterval(POLL_MS);
  const now = useNow();
  const query = useAppointment(org.id, id, poll);
  const members = useOrgMembers(org.id);
  const names = memberNameMap(members.data);
  const request = query.data;
  // Generic tab title: patient names do not belong in browser history.
  useDocumentTitle(t("appointments.title"));

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }
  if (query.error) {
    return (
      <div className="flex flex-col gap-3">
        <BackLink />
        <QueryError error={query.error} onRetry={() => void query.refetch()} />
      </div>
    );
  }
  if (!request) {
    return (
      <div className="flex flex-col gap-3">
        <BackLink />
        <Card>
          <EmptyState
            icon={CalendarX2}
            title={t("appointments.notFoundTitle")}
            text={t("appointments.notFoundText")}
          />
        </Card>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow={<BackLink />}
        title={request.customer_name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <AppointmentStatusBadge status={request.status} />
            <SourceBadge source={request.source} />
            <span className="text-sm text-slate-600">
              {t("appointments.createdAgo", {
                time: formatRelativeTime(lang, request.created_at, now),
              })}
            </span>
          </span>
        }
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
          <StatusCard orgId={org.id} request={request} />
          <DetailsCard request={request} />
          <NotesCard orgId={org.id} requestId={request.id} members={members.data} />
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <NotifyCard orgId={org.id} request={request} />
          <AssignCard orgId={org.id} request={request} members={members} />
          <SourceCard request={request} names={names} />
          {canManage(org.role) ? (
            <DeleteCard orgId={org.id} request={request} />
          ) : (
            <p className="text-xs text-slate-500">{t("appointments.deleteManagersOnly")}</p>
          )}
        </div>
      </div>
    </>
  );
}
