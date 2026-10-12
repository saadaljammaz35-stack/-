import { useId, type ReactNode } from "react";
import { CircleAlert } from "lucide-react";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/cn";
import { FieldContext } from "./fieldContext";

export interface FieldProps {
  label: ReactNode;
  /** Help text under the control. */
  hint?: ReactNode;
  /** Validation message; also marks the control aria-invalid. */
  error?: ReactNode;
  required?: boolean;
  /** Shows "(optional)" next to the label. */
  optional?: boolean;
  /** Pass when the control needs a specific id; otherwise one is generated. */
  id?: string;
  className?: string;
  /** Visually hide the label (still read by screen readers). */
  hideLabel?: boolean;
  children: ReactNode;
}

/**
 * Label + control + hint + error, wired for screen readers:
 *
 *   <Field label={t("auth.email")} error={errors.email} required>
 *     <Input type="email" autoComplete="email" {...register} />
 *   </Field>
 */
export function Field({
  label,
  hint,
  error,
  required = false,
  optional = false,
  id,
  className,
  hideLabel = false,
  children,
}: FieldProps) {
  const { t } = useI18n();
  const generated = useId();
  const controlId = id ?? `field-${generated}`;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <FieldContext value={{ id: controlId, describedBy, invalid: Boolean(error), required }}>
      <div className={cn("flex flex-col gap-1.5", className)}>
        <label
          htmlFor={controlId}
          className={cn("text-sm font-bold text-slate-800", hideLabel && "sr-only")}
        >
          {label}
          {required && (
            <span className="ms-1 text-red-600" aria-hidden="true">
              *
            </span>
          )}
          {optional && !required && (
            <span className="ms-1.5 text-xs font-medium text-slate-500">
              ({t("common.optional")})
            </span>
          )}
        </label>
        {children}
        {hint && (
          <p id={hintId} className="text-[0.8125rem] leading-relaxed text-slate-600">
            {hint}
          </p>
        )}
        {error && (
          <p
            id={errorId}
            className="flex items-start gap-1.5 text-[0.8125rem] font-medium text-red-700"
          >
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </p>
        )}
      </div>
    </FieldContext>
  );
}
