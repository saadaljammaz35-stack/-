import { useState, type InputHTMLAttributes, type ReactNode, type Ref } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/cn";
import { useFieldControl } from "./Field";

/** Shared look for text-like controls. 16px text so iOS Safari never zooms in. */
export const controlClasses =
  "block w-full min-h-11 rounded-xl border border-slate-300 bg-white px-3.5 text-base text-slate-900 shadow-xs " +
  "placeholder:text-slate-400 transition-colors " +
  "hover:border-slate-400 focus:border-primary focus:outline-none focus:ring-3 focus:ring-primary/20 " +
  "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 " +
  "aria-invalid:border-red-500 aria-invalid:focus:ring-red-500/20";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  ref?: Ref<HTMLInputElement>;
  /** Content inside the field at the start side (icon, prefix). */
  startAdornment?: ReactNode;
  /** Content inside the field at the end side (button, suffix). */
  endAdornment?: ReactNode;
}

export function Input({ className, startAdornment, endAdornment, ref, ...props }: InputProps) {
  const merged = useFieldControl(props);
  const input = (
    <input
      ref={ref}
      className={cn(
        controlClasses,
        Boolean(startAdornment) && "ps-10",
        Boolean(endAdornment) && "pe-12",
        className,
      )}
      {...merged}
    />
  );
  if (!startAdornment && !endAdornment) return input;
  return (
    <div className="relative">
      {startAdornment && (
        <div className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3.5 text-slate-500">
          {startAdornment}
        </div>
      )}
      {input}
      {endAdornment && (
        <div className="absolute inset-y-0 end-0 flex items-center pe-1">{endAdornment}</div>
      )}
    </div>
  );
}

/** Password field with a show/hide toggle. */
export function PasswordInput(props: Omit<InputProps, "type" | "endAdornment">) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  return (
    <Input
      {...props}
      type={visible ? "text" : "password"}
      dir="ltr"
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      endAdornment={
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          className="inline-flex size-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          aria-label={visible ? t("common.hidePassword") : t("common.showPassword")}
          aria-pressed={visible}
        >
          {visible ? <EyeOff className="size-5" aria-hidden="true" /> : <Eye className="size-5" aria-hidden="true" />}
        </button>
      }
    />
  );
}
