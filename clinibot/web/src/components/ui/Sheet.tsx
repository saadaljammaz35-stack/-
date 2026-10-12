import { useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/cn";
import { useModal } from "./useModal";

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  /** Accessible name; shown as the header unless `header` is given. */
  title: string;
  /** Custom header content (e.g. the logo). */
  header?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Slide-over panel from the start side (right in Arabic, left in English). */
export function Sheet({ open, onClose, title, header, children, className }: SheetProps) {
  const { t, dir } = useI18n();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useModal({ open, onClose, panelRef });

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50" dir={dir}>
      <div
        className="absolute inset-0 animate-fade-in bg-slate-950/50"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          "absolute inset-y-0 start-0 flex w-80 max-w-[86vw] flex-col bg-white shadow-overlay outline-none",
          "pt-safe pb-safe ps-safe animate-fade-in",
          className,
        )}
      >
        <div className="flex min-h-16 items-center justify-between gap-3 border-b border-slate-100 px-4">
          <h2 id={titleId} className={cn(header ? "sr-only" : "text-base font-extrabold")}>
            {title}
          </h2>
          {header}
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-11 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            aria-label={t("common.closeMenu")}
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
