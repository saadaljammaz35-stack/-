import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  /**
   * Shows a spinner-free busy state: aria-disabled + aria-busy, and clicks are
   * ignored. Not natively disabled, so keyboard focus stays on the switch.
   */
  busy?: boolean;
  className?: string;
  id?: string;
}

/** On/off toggle (role="switch"). Label sits at the start, the switch at the end. */
export function Switch({
  checked,
  onCheckedChange,
  label,
  description,
  disabled = false,
  busy = false,
  className,
  id,
}: SwitchProps) {
  const generated = useId();
  const switchId = id ?? `switch-${generated}`;
  const labelId = `${switchId}-label`;
  const descriptionId = description ? `${switchId}-description` : undefined;
  return (
    <div className={cn("flex items-center justify-between gap-4", className)}>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span id={labelId} className="text-sm font-bold text-slate-800">
          {label}
        </span>
        {description && (
          <span id={descriptionId} className="text-[0.8125rem] text-slate-600">
            {description}
          </span>
        )}
      </div>
      <button
        id={switchId}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        aria-describedby={descriptionId}
        aria-busy={busy || undefined}
        aria-disabled={disabled || busy || undefined}
        disabled={disabled}
        onClick={() => {
          if (busy) return;
          onCheckedChange(!checked);
        }}
        className="group relative inline-flex min-h-11 shrink-0 items-center rounded-full px-0.5 disabled:cursor-not-allowed disabled:opacity-55 aria-disabled:cursor-not-allowed aria-disabled:opacity-55"
      >
        <span
          className={cn(
            "flex h-7 w-12 items-center rounded-full p-0.5 transition-colors",
            checked ? "bg-accent-strong" : "bg-slate-300 group-hover:bg-slate-400",
          )}
        >
          <span
            className={cn(
              "size-6 rounded-full bg-white shadow transition-transform",
              checked && "translate-x-5 rtl:-translate-x-5",
            )}
          />
        </span>
      </button>
    </div>
  );
}
