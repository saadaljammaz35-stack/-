import type { Ref, SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { useFieldControl } from "./fieldContext";
import { controlClasses } from "./Input";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  ref?: Ref<HTMLSelectElement>;
  /** Shown as a disabled first option while nothing is chosen. */
  placeholder?: string;
}

/** Native <select> (best on phones), styled to match Input. Pass <option>s as children. */
export function Select({ className, placeholder, children, ref, ...props }: SelectProps) {
  const merged = useFieldControl(props);
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(controlClasses, "appearance-none pe-10", className)}
        {...merged}
      >
        {placeholder !== undefined && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute inset-y-0 end-3 my-auto size-5 text-slate-500"
        aria-hidden="true"
      />
    </div>
  );
}
