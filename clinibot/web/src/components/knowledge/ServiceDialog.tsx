import { useId, useState, type FormEvent } from "react";
import { Button, Dialog, Field, Input, Select, Switch, Textarea } from "@/components/ui";
import { QueryError } from "@/components/layout/QueryError";
import { useI18n } from "@/i18n";
import {
  EMPTY_SERVICE,
  LIMITS,
  PRICE_TYPES,
  isPriceType,
  serviceToForm,
  validateService,
  type FormErrors,
  type PriceType,
  type ServiceField,
  type ServiceFormValues,
  type ServiceRow,
} from "./model";
import { useSaveService } from "./queries";
import { useFieldErrorText } from "./useFieldErrorText";

const PRICE_TYPE_LABELS = {
  fixed: "knowledge.priceTypeFixed",
  starting_from: "knowledge.priceTypeStartingFrom",
  on_consultation: "knowledge.priceTypeOnConsultation",
} as const satisfies Record<PriceType, string>;

export interface ServiceDialogProps {
  orgId: string;
  /** null = add a new service. */
  service: ServiceRow | null;
  onClose: () => void;
  onSaved: (created: boolean) => void;
}

/** Add / edit a service. Mount it only while open so the form starts fresh. */
export function ServiceDialog({ orgId, service, onClose, onSaved }: ServiceDialogProps) {
  const { t, formatNumber } = useI18n();
  const formId = useId();
  const save = useSaveService(orgId);
  const errorText = useFieldErrorText();
  const [values, setValues] = useState<ServiceFormValues>(
    service ? serviceToForm(service) : EMPTY_SERVICE,
  );
  const [errors, setErrors] = useState<FormErrors<ServiceField>>({});
  const [submitted, setSubmitted] = useState(false);

  function set<K extends ServiceField>(key: K, value: ServiceFormValues[K]) {
    const next = { ...values, [key]: value };
    setValues(next);
    // After the first submit, keep the messages in step with what is typed.
    if (submitted) {
      const result = validateService(next);
      setErrors(result.ok ? {} : result.errors);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    const result = validateService(values);
    if (!result.ok) {
      setErrors(result.errors);
      const form = event.currentTarget;
      requestAnimationFrame(() =>
        form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      );
      return;
    }
    setErrors({});
    save.mutate(
      { id: service?.id ?? null, payload: result.payload },
      { onSuccess: () => onSaved(service === null) },
    );
  }

  const needsPrice = values.price_type !== "on_consultation";

  return (
    <Dialog
      open
      onClose={onClose}
      dismissible={!save.isPending}
      size="lg"
      title={service ? t("knowledge.serviceEditTitle") : t("knowledge.serviceNewTitle")}
      description={t("knowledge.serviceDialogDescription")}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form={formId} loading={save.isPending}>
            {service ? t("common.saveChanges") : t("knowledge.addService")}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="flex flex-col gap-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label={t("knowledge.fieldNameAr")}
            hint={t("knowledge.nameHint")}
            error={errorText(errors.name_ar)}
          >
            <Input
              dir="rtl"
              lang="ar"
              value={values.name_ar}
              onChange={(event) => set("name_ar", event.target.value)}
              maxLength={LIMITS.nameMax + 20}
              autoComplete="off"
            />
          </Field>
          <Field
            label={t("knowledge.fieldNameEn")}
            hint={t("knowledge.nameHint")}
            error={errorText(errors.name_en)}
          >
            <Input
              dir="ltr"
              lang="en"
              value={values.name_en}
              onChange={(event) => set("name_en", event.target.value)}
              maxLength={LIMITS.nameMax + 20}
              autoComplete="off"
            />
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label={t("knowledge.fieldPriceType")}
            error={errorText(errors.price_type)}
            required
          >
            <Select
              value={values.price_type}
              onChange={(event) => {
                const next = event.target.value;
                if (isPriceType(next)) set("price_type", next);
              }}
            >
              {PRICE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(PRICE_TYPE_LABELS[type])}
                </option>
              ))}
            </Select>
          </Field>
          {needsPrice ? (
            <Field
              label={t("knowledge.fieldPrice")}
              hint={t("knowledge.priceHint")}
              error={errorText(errors.price)}
              required
            >
              <Input
                dir="ltr"
                inputMode="decimal"
                value={values.price}
                onChange={(event) => set("price", event.target.value)}
                autoComplete="off"
                endAdornment={
                  <span className="pe-3 text-sm font-bold text-slate-500" aria-hidden="true">
                    {t("knowledge.currencyShort")}
                  </span>
                }
              />
            </Field>
          ) : (
            <p className="self-end rounded-xl bg-slate-50 px-3.5 py-3 text-[0.8125rem] leading-relaxed text-slate-700">
              {t("knowledge.priceConsultationHint")}
            </p>
          )}
        </div>

        <Field
          label={t("knowledge.fieldDuration")}
          hint={t("knowledge.durationHint", {
            min: formatNumber(LIMITS.durationMin),
            max: formatNumber(LIMITS.durationMax),
          })}
          error={errorText(errors.duration)}
          optional
          className="sm:max-w-[50%] sm:pe-2.5"
        >
          <Input
            dir="ltr"
            inputMode="numeric"
            value={values.duration}
            onChange={(event) => set("duration", event.target.value)}
            autoComplete="off"
          />
        </Field>

        <Field
          label={t("knowledge.fieldDescriptionAr")}
          hint={t("knowledge.descriptionHint", { max: formatNumber(LIMITS.descriptionMax) })}
          error={errorText(errors.description_ar)}
          optional
        >
          <Textarea
            dir="rtl"
            lang="ar"
            rows={3}
            value={values.description_ar}
            onChange={(event) => set("description_ar", event.target.value)}
          />
        </Field>
        <Field
          label={t("knowledge.fieldDescriptionEn")}
          hint={t("knowledge.descriptionHint", { max: formatNumber(LIMITS.descriptionMax) })}
          error={errorText(errors.description_en)}
          optional
        >
          <Textarea
            dir="ltr"
            lang="en"
            rows={3}
            value={values.description_en}
            onChange={(event) => set("description_en", event.target.value)}
          />
        </Field>

        <Switch
          checked={values.is_active}
          onCheckedChange={(checked) => set("is_active", checked)}
          label={t("knowledge.serviceActiveLabel")}
          description={t("knowledge.serviceActiveHint")}
        />

        {save.error ? <QueryError error={save.error} /> : null}
      </form>
    </Dialog>
  );
}
