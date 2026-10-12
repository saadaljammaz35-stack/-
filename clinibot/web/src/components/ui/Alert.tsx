import type { ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from "lucide-react";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/cn";

export type AlertTone = "info" | "success" | "warning" | "error";

const STYLES: Record<AlertTone, { box: string; icon: string; Icon: typeof Info }> = {
  info: { box: "border-sky-200 bg-sky-50 text-sky-950", icon: "text-sky-600", Icon: Info },
  success: { box: "border-emerald-200 bg-mint text-emerald-950", icon: "text-accent-strong", Icon: CircleCheck },
  warning: { box: "border-amber-200 bg-amber-50 text-amber-950", icon: "text-amber-600", Icon: TriangleAlert },
  error: { box: "border-red-200 bg-red-50 text-red-950", icon: "text-red-600", Icon: CircleAlert },
};

export interface AlertProps {
  tone?: AlertTone;
  title?: ReactNode;
  children?: ReactNode;
  /** Buttons/links under the text. */
  action?: ReactNode;
  onDismiss?: () => void;
  className?: string;
}

/**
 * Inline message. Errors and warnings are announced immediately (role="alert");
 * info/success politely (role="status").
 */
export function Alert({ tone = "info", title, children, action, onDismiss, className }: AlertProps) {
  const { t } = useI18n();
  const { box, icon, Icon } = STYLES[tone];
  return (
    <div
      role={tone === "error" || tone === "warning" ? "alert" : "status"}
      className={cn("flex items-start gap-3 rounded-xl border px-4 py-3 text-sm", box, className)}
    >
      <Icon className={cn("mt-0.5 size-5 shrink-0", icon)} aria-hidden="true" />
      <div className="min-w-0 flex-1 leading-relaxed">
        {title && <p className="font-bold">{title}</p>}
        {children && <div className={cn(title && "mt-0.5")}>{children}</div>}
        {action && <div className="mt-3 flex flex-wrap gap-2">{action}</div>}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="-m-2 inline-flex size-9 shrink-0 items-center justify-center rounded-lg opacity-70 hover:bg-black/5 hover:opacity-100"
          aria-label={t("common.close")}
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
