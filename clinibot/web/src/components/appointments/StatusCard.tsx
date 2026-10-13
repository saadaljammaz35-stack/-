import { useState } from "react";
import { CalendarCheck, CalendarClock, CheckCheck, PhoneCall, XCircle } from "lucide-react";
import { Button, Card, CardBody, CardHeader, ConfirmDialog, useToast } from "@/components/ui";
import { useI18n, type MessageKey } from "@/i18n";
import { errorText } from "@/lib/errors";
import { formatDateTime } from "@/components/dashboard/time";
import { AppointmentStatusBadge } from "./badges";
import {
  allowedNextStatuses,
  isFinalStatus,
  type AppointmentDetailRow,
  type AppointmentStatus,
} from "./model";
import { AppointmentChangedError, useUpdateAppointment } from "./queries";
import { ScheduleDialog } from "./ScheduleDialog";

const STATUS_TEXT: Record<AppointmentStatus, MessageKey> = {
  new: "appointments.statusTextNew",
  contacted: "appointments.statusTextContacted",
  confirmed: "appointments.statusTextConfirmed",
  completed: "appointments.statusTextCompleted",
  cancelled: "appointments.statusTextCancelled",
};

/**
 * The request's status and the moves the database allows from it (see
 * APPOINTMENT_TRANSITIONS). Confirming always goes through the time dialog.
 */
export function StatusCard({ orgId, request }: { orgId: string; request: AppointmentDetailRow }) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const update = useUpdateAppointment(orgId, request.id);
  const [schedule, setSchedule] = useState<"confirm" | "edit" | null>(null);
  const [pending, setPending] = useState<"completed" | "cancelled" | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const next = allowedNextStatuses(request.status);

  function describe(error: unknown): string {
    return error instanceof AppointmentChangedError
      ? t("appointments.errorChanged")
      : errorText(t, error);
  }

  function markContacted() {
    update.mutate(
      { patch: { status: "contacted" }, expectStatus: request.status },
      {
        onSuccess: () => toast.success(t("appointments.toastContacted")),
        onError: (error) => toast.error(describe(error)),
      },
    );
  }

  async function finish(status: "completed" | "cancelled") {
    setConfirmError(null);
    try {
      await update.mutateAsync({ patch: { status }, expectStatus: request.status });
      setPending(null);
      toast.success(
        t(status === "completed" ? "appointments.toastCompleted" : "appointments.toastCancelled"),
      );
    } catch (error) {
      setConfirmError(describe(error));
    }
  }

  return (
    <Card as="section" aria-labelledby="status-title">
      <CardHeader
        title={<span id="status-title">{t("appointments.statusTitle")}</span>}
        actions={<AppointmentStatusBadge status={request.status} />}
      />
      <CardBody className="flex flex-col gap-4">
        <p className="text-sm leading-relaxed text-slate-700">
          {t(STATUS_TEXT[request.status], {
            time: request.scheduled_for ? formatDateTime(lang, request.scheduled_for) : "",
          })}
        </p>

        {isFinalStatus(request.status) ? (
          <p className="text-[0.8125rem] text-slate-500">{t("appointments.statusFinal")}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {next.includes("contacted") && (
              <Button
                variant="outline"
                onClick={markContacted}
                disabled={update.isPending}
                icon={<PhoneCall className="size-4" aria-hidden="true" />}
              >
                {t("appointments.actionContacted")}
              </Button>
            )}
            {next.includes("confirmed") && (
              <Button
                onClick={() => setSchedule("confirm")}
                disabled={update.isPending}
                icon={<CalendarCheck className="size-4" aria-hidden="true" />}
              >
                {t("appointments.actionConfirm")}
              </Button>
            )}
            {request.status === "confirmed" && (
              <Button
                variant="outline"
                onClick={() => setSchedule("edit")}
                disabled={update.isPending}
                icon={<CalendarClock className="size-4" aria-hidden="true" />}
              >
                {t("appointments.actionEditTime")}
              </Button>
            )}
            {next.includes("completed") && (
              <Button
                variant="secondary"
                onClick={() => {
                  setConfirmError(null);
                  setPending("completed");
                }}
                disabled={update.isPending}
                icon={<CheckCheck className="size-4" aria-hidden="true" />}
              >
                {t("appointments.actionComplete")}
              </Button>
            )}
            {next.includes("cancelled") && (
              <Button
                variant="ghost"
                className="text-red-700 hover:bg-red-50"
                onClick={() => {
                  setConfirmError(null);
                  setPending("cancelled");
                }}
                disabled={update.isPending}
                icon={<XCircle className="size-4" aria-hidden="true" />}
              >
                {t("appointments.actionCancel")}
              </Button>
            )}
          </div>
        )}
      </CardBody>

      <ScheduleDialog
        orgId={orgId}
        request={request}
        mode={schedule ?? "confirm"}
        open={schedule !== null}
        onClose={() => setSchedule(null)}
        onSaved={() => {
          toast.success(
            t(
              schedule === "edit" ? "appointments.toastTimeChanged" : "appointments.toastConfirmed",
            ),
          );
          setSchedule(null);
        }}
      />

      <ConfirmDialog
        open={pending === "completed"}
        onClose={() => setPending(null)}
        onConfirm={() => finish("completed")}
        tone="primary"
        title={t("appointments.completeTitle")}
        description={t("appointments.completeText")}
        confirmLabel={t("appointments.completeConfirm")}
        error={confirmError}
      />
      <ConfirmDialog
        open={pending === "cancelled"}
        onClose={() => setPending(null)}
        onConfirm={() => finish("cancelled")}
        title={t("appointments.cancelTitle")}
        description={
          request.customer_notified_at
            ? t("appointments.cancelTextNotified")
            : t("appointments.cancelText")
        }
        confirmLabel={t("appointments.cancelConfirm")}
        cancelLabel={t("appointments.cancelKeep")}
        error={confirmError}
      />
    </Card>
  );
}
