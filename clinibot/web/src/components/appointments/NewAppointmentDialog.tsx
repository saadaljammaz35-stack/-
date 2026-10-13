import { useId, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { Button, Dialog, Field, Input, Select, Textarea, useToast } from "@/components/ui";
import { useI18n } from "@/i18n";
import { errorText } from "@/lib/errors";
import { riyadhToday } from "@/components/dashboard/time";
import {
  isTimeWindow,
  NAME_MAX,
  NAME_MIN,
  normalizeCustomerPhone,
  NOTES_MAX,
  serviceName,
  TIME_WINDOW_LABELS,
  TIME_WINDOWS,
  type TimeWindow,
} from "./model";
import { useActiveServices, useCreateAppointment } from "./queries";

interface Values {
  name: string;
  phone: string;
  serviceId: string;
  date: string;
  window: TimeWindow;
  notes: string;
}

const EMPTY: Values = { name: "", phone: "", serviceId: "", date: "", window: "any", notes: "" };

type Errors = Partial<Record<keyof Values | "form", string>>;

/** A request taken by phone or at the desk. */
export function NewAppointmentDialog({
  open,
  onClose,
  orgId,
}: {
  open: boolean;
  onClose: () => void;
  orgId: string;
}) {
  if (!open) return null;
  return <NewAppointmentForm onClose={onClose} orgId={orgId} />;
}

function NewAppointmentForm({ onClose, orgId }: { onClose: () => void; orgId: string }) {
  const { t, tRich, lang, formatNumber } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();
  const formId = useId();
  const services = useActiveServices(orgId);
  const create = useCreateAppointment(orgId);
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const today = riyadhToday();
  const normalized = values.phone.trim() ? normalizeCustomerPhone(values.phone) : null;

  function set<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function validate(): Errors {
    const next: Errors = {};
    const name = values.name.trim();
    if (name.length < NAME_MIN || name.length > NAME_MAX) {
      next.name = t("appointments.newNameInvalid", {
        min: formatNumber(NAME_MIN),
        max: formatNumber(NAME_MAX),
      });
    }
    if (!values.phone.trim()) next.phone = t("appointments.newPhoneRequired");
    else if (!normalized) next.phone = t("appointments.newPhoneInvalid");
    if (values.date && values.date < today) next.date = t("appointments.newDatePast");
    if (values.notes.trim().length > NOTES_MAX) {
      next.notes = t("appointments.newNotesTooLong", { max: formatNumber(NOTES_MAX) });
    }
    return next;
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0 || !normalized) {
      const form = event.currentTarget;
      requestAnimationFrame(() =>
        form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      );
      return;
    }
    create.mutate(
      {
        customer_name: values.name.trim(),
        customer_phone: normalized,
        service_id: values.serviceId || null,
        preferred_date: values.date || null,
        preferred_time_window: values.window,
        customer_notes: values.notes.trim() || null,
      },
      {
        onSuccess: (id) => {
          toast.success(t("appointments.toastCreated"));
          onClose();
          void navigate(`/app/appointments/${id}`);
        },
        onError: (error) => setErrors({ form: errorText(t, error) }),
      },
    );
  }

  return (
    <Dialog
      open
      onClose={onClose}
      dismissible={!create.isPending}
      size="lg"
      title={t("appointments.newTitle")}
      description={t("appointments.newDescription")}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={create.isPending}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form={formId} loading={create.isPending}>
            {t("appointments.newSubmit")}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Field label={t("appointments.fieldName")} error={errors.name} required>
          <Input
            value={values.name}
            onChange={(event) => set("name", event.target.value)}
            autoComplete="off"
            maxLength={NAME_MAX}
          />
        </Field>
        <Field
          label={t("appointments.fieldPhone")}
          error={errors.phone}
          hint={
            normalized
              ? tRich("appointments.newPhoneSavedAs", {
                  phone: (
                    <bdi dir="ltr" className="font-bold">
                      {normalized}
                    </bdi>
                  ),
                })
              : t("appointments.newPhoneHint")
          }
          required
        >
          <Input
            type="tel"
            inputMode="tel"
            dir="ltr"
            value={values.phone}
            onChange={(event) => set("phone", event.target.value)}
            autoComplete="off"
            placeholder="05XXXXXXXX"
          />
        </Field>
        <Field
          label={t("appointments.fieldService")}
          optional
          hint={
            services.data && services.data.length === 0
              ? t("appointments.newNoServices")
              : services.error
                ? errorText(t, services.error)
                : undefined
          }
        >
          <Select
            value={values.serviceId}
            onChange={(event) => set("serviceId", event.target.value)}
            disabled={services.isPending}
          >
            <option value="">{t("appointments.newServiceNone")}</option>
            {services.data?.map((service) => (
              <option key={service.id} value={service.id}>
                {serviceName(service, lang)}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t("appointments.fieldPreferredDate")} error={errors.date} optional>
            <Input
              type="date"
              min={today}
              value={values.date}
              onChange={(event) => set("date", event.target.value)}
            />
          </Field>
          <Field label={t("appointments.fieldWindow")}>
            <Select
              value={values.window}
              onChange={(event) =>
                set("window", isTimeWindow(event.target.value) ? event.target.value : "any")
              }
            >
              {TIME_WINDOWS.map((window) => (
                <option key={window} value={window}>
                  {t(TIME_WINDOW_LABELS[window])}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label={t("appointments.fieldNotes")} error={errors.notes} optional>
          <Textarea
            rows={3}
            value={values.notes}
            maxLength={NOTES_MAX}
            onChange={(event) => set("notes", event.target.value)}
            dir="auto"
          />
        </Field>
        <p className="text-[0.8125rem] text-slate-600">{t("appointments.newNotConfirmed")}</p>
        {errors.form && (
          <p role="alert" className="text-sm font-medium text-red-700">
            {errors.form}
          </p>
        )}
      </form>
    </Dialog>
  );
}
