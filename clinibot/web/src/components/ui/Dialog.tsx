import { useId, useRef, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/cn";
import { useModal } from "./useModal";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** Buttons row at the bottom (end-aligned on desktop, stacked on phones). */
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  /** Element to focus on open (defaults to the first focusable element). */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** False while a request runs: Escape, the backdrop and × do nothing. */
  dismissible?: boolean;
  /** Use "alertdialog" for confirmations that interrupt the user. */
  role?: "dialog" | "alertdialog";
}

const SIZES = { sm: "sm:max-w-md", md: "sm:max-w-lg", lg: "sm:max-w-2xl" } as const;

/**
 * Modal dialog: focus moves inside and stays there, Escape closes, focus
 * returns to the opener. On phones it is a bottom sheet clear of the home
 * indicator.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  initialFocusRef,
  dismissible = true,
  role = "dialog",
}: DialogProps) {
  const { t, dir } = useI18n();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useModal({ open, onClose, panelRef, initialFocusRef, dismissible });

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6"
      dir={dir}
    >
      <div
        className="absolute inset-0 animate-fade-in bg-slate-950/50 backdrop-blur-[2px]"
        aria-hidden="true"
        onClick={dismissible ? onClose : undefined}
      />
      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          "relative flex max-h-[92dvh] w-full animate-slide-up flex-col rounded-t-3xl bg-white shadow-overlay outline-none sm:rounded-2xl",
          SIZES[size],
        )}
      >
        <div className="flex items-start gap-3 px-5 pt-5 sm:px-6">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-lg font-extrabold text-slate-900">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-1 text-sm leading-relaxed text-slate-600">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={!dismissible}
            className="-me-2 -mt-1 inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40"
            aria-label={t("common.close")}
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        {children && (
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">{children}</div>
        )}
        {footer && (
          <div className="flex flex-col-reverse gap-2 border-t border-slate-100 px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:px-6">
            {footer}
          </div>
        )}
        {!footer && <div className="pb-[max(0.5rem,env(safe-area-inset-bottom))]" />}
      </div>
    </div>,
    document.body,
  );
}
