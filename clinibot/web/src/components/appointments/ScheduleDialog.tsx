import { useId, useState, type FormEvent } from "react";
import { Alert, Button, Dialog, Field, Input } from "@/components/ui";
import { useI18n } from "@/i18n";
import { errorText } from "@/lib/errors";
import {
  formatDateTime,
  isPast,
  riyadhLocalToUtcIso,
  riyadhToday,
  utcToRiyadhLocal,
} from "@/components/dashboard/time";
import { isTimeWindow, TIME_WINDOW_LABELS, type AppointmentDetailRow } from "./model";
import { AppointmentChangedError, useUpdateAppointment } from "./queries";

/**
 * Confirming needs the time actually agreed with the patient, entered in the
 * clinic's time zone (Asia/Riyadh, UTC+3) and stored as UTC in scheduled_for,
 * in the same update as status "confirmed". The same dialog edits the time of
 * a confirmed request.
 */
export function ScheduleDialog({
  orgId,
  request,
  mode,
  open,
  onClose,
  onSaved,
}: {
  orgId: string;
  request: AppointmentDetailRow;
  mode: "confirm" | "edit";
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  if (!open) return null;
  return (
    <ScheduleDialogInner
      orgId={orgId}
      request={request}
      mode={mode}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}

function ScheduleDialogInner({
  orgId,
  request,
  mode,
  onClose,
  onSaved,
}: {
  orgId: string;
  request: AppointmentDetailRow;
  mode: "confirm" | "edit";
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t, lang, formatDate } = useI18n();
  const formId = useId();
  const update = useUpdateAppointment(orgId, request.id);
  const today = riyadhToday();
  const current = request.scheduled_for ? utcToRiyadhLocal(request.scheduled_for) : null;
  const [date, setDate] = useState(() => {
    if (mode === "edit" && current) return current.date;
    return request.preferred_date && request.preferred_date >= today ? request.preferred_date : "";
  });
  const [time, setTime] = useState(() => (mode === "edit" && current ? current.time : ""));
  const [errors, setErrors] = useState<{ date?: string; time?: string; form?: string }>({});

  const iso = date && time ? riyadhLocalToUtcIso(date, time) : null;

  function submit(event: FormEvent) {
    event.preventDefault();
    const next: typeof errors = {};
    if (!date) next.date = t("appointments.scheduleDateRequired");
    if (!time) next.time = t("appointments.scheduleTimeRequired");
    if (date && time && !iso) next.date = t("appointments.scheduleInvalid");
    if (mode === "edit" && iso && iso === request.scheduled_for) {
      next.time = t("appointments.scheduleUnchanged");
    }
    setErrors(next);
    if (Object.keys(next).length > 0 || !iso) return;

    update.mutate(
      mode === "confirm"
        ? { patch: { status: "confirmed", scheduled_for: iso }, expectStatus: request.status }
        : { patch: { scheduled_for: iso }, expectStatus: "confirmed" },
      {
        onSuccess: onSaved,
        onError: (error) =>
          setErrors({
            form:
              error instanceof AppointmentChangedError
                ? t("appointments.errorChanged")
                : errorText(t, error),
          }),
      },
    );
  }

  return (
    <Dialog
      open
      onClose={onClose}
      dismissible={!update.isPending}
      title={mode === "confirm" ? t("appointments.confirmTitle") : t("appointments.editTimeTitle")}
      description={
        mode === "confirm"
          ? t("appointments.confirmDescription", { name: request.customer_name })
          : t("appointments.editTimeDescription")
      }
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={update.isPending}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form={formId} loading={update.isPending}>
            {mode === "confirm"
              ? t("appointments.confirmSubmit")
              : t("appointments.editTimeSubmit")}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="flex flex-col gap-4">
        {mode === "edit" && (
          <Alert tone="warning">
            {request.customer_notified_at
              ? t("appointments.editTimeWarningNotified")
              : t("appointments.editTimeWarning")}
          </Alert>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t("appointments.scheduleDate")} error={errors.date} required>
            <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </Field>
          <Field label={t("appointments.scheduleTime")} error={errors.time} required>
            <Input
              type="time"
              value={time}
              step={300}
              onChange={(event) => setTime(event.target.value)}
            />
          </Field>
        </div>
        <p className="text-[0.8125rem] text-slate-600">{t("appointments.scheduleTimezone")}</p>
        <div aria-live="polite" className="flex flex-col gap-3">
          {iso && (
            <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-800">
              {t("appointments.schedulePreview", { time: formatDateTime(lang, iso) })}
            </p>
          )}
          {/* Allowed (a walk-in confirmed after the fact), but never silently. */}
          {iso && isPast(iso) && (
            <Alert tone="warning">{t("appointments.schedulePastWarning")}</Alert>
          )}
        </div>
        {mode === "confirm" && (
          <p className="text-[0.8125rem] text-slate-600">
            {t("appointments.schedulePreferred", {
              date: request.preferred_date
                ? formatDate(request.preferred_date, {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })
                : t("appointments.anyDay"),
              window: t(
                TIME_WINDOW_LABELS[
                  isTimeWindow(request.preferred_time_window)
                    ? request.preferred_time_window
                    : "any"
                ],
              ),
            })}
          </p>
        )}
        {errors.form && (
          <p role="alert" className="text-sm font-medium text-red-700">
            {errors.form}
          </p>
        )}
      </form>
    </Dialog>
  );
}
