import { useId, type InputHTMLAttributes, type ReactNode, type Ref } from "react";
import { CircleAlert } from "lucide-react";
import { cn } from "@/lib/cn";

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  ref?: Ref<HTMLInputElement>;
  /** May contain links; clicking a link does not toggle the box. */
  label: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
}

export function Checkbox({ label, description, error, className, id, ref, ...props }: CheckboxProps) {
  const generated = useId();
  const inputId = id ?? `checkbox-${generated}`;
  const descriptionId = description ? `${inputId}-description` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-start gap-3">
        <span className="flex h-6 shrink-0 items-center">
          <input
            ref={ref}
            id={inputId}
            type="checkbox"
            className="size-5 cursor-pointer rounded border-slate-400 accent-primary disabled:cursor-not-allowed"
            aria-describedby={[descriptionId, errorId].filter(Boolean).join(" ") || undefined}
            aria-invalid={error ? true : undefined}
            {...props}
          />
        </span>
        <div className="flex flex-col gap-0.5 pt-px">
          <label htmlFor={inputId} className="cursor-pointer text-sm leading-relaxed text-slate-800">
            {label}
          </label>
          {description && (
            <p id={descriptionId} className="text-[0.8125rem] text-slate-600">
              {description}
            </p>
          )}
        </div>
      </div>
      {error && (
        <p id={errorId} className="flex items-start gap-1.5 text-[0.8125rem] font-medium text-red-700">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
