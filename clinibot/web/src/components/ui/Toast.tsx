import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/cn";
import { ToastContext, type ToastApi, type ToastItem, type ToastOptions } from "./toastContext";

const ICONS = { success: CircleCheck, error: CircleAlert, info: Info } as const;
const ICON_COLORS = {
  success: "text-accent",
  error: "text-red-400",
  info: "text-sky-300",
} as const;

/** Wrap the app once. Then: const toast = useToast(); toast.success(t("common.saved")). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((items) => items.filter((item) => item.id !== id));
  }, []);

  const show = useCallback((options: ToastOptions) => {
    const id = nextId.current++;
    const tone = options.tone ?? "info";
    const item: ToastItem = {
      id,
      tone,
      title: options.title,
      message: options.message,
      duration: options.duration ?? (tone === "error" ? 8000 : 5000),
    };
    // Keep at most 3 on screen; the same message twice replaces the old one.
    setToasts((items) => [...items.filter((t) => t.message !== item.message).slice(-2), item]);
    return id;
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      show,
      dismiss,
      success: (message) => show({ tone: "success", message }),
      error: (message) => show({ tone: "error", message }),
      info: (message) => show({ tone: "info", message }),
    }),
    [show, dismiss],
  );

  return (
    <ToastContext value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-end sm:px-6 sm:pb-6">
        {/* Two always-present live regions: errors are announced right away, the rest politely. */}
        <div aria-live="assertive" className="flex w-full flex-col items-center gap-2 sm:items-end">
          {toasts
            .filter((item) => item.tone === "error")
            .map((item) => (
              <ToastView key={item.id} item={item} onDismiss={dismiss} />
            ))}
        </div>
        <div aria-live="polite" className="flex w-full flex-col items-center gap-2 sm:items-end">
          {toasts
            .filter((item) => item.tone !== "error")
            .map((item) => (
              <ToastView key={item.id} item={item} onDismiss={dismiss} />
            ))}
        </div>
      </div>
    </ToastContext>
  );
}

function ToastView({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  const { t } = useI18n();
  const Icon = ICONS[item.tone];
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (item.duration <= 0 || paused) return;
    const timer = window.setTimeout(() => onDismiss(item.id), item.duration);
    return () => window.clearTimeout(timer);
  }, [item.duration, item.id, onDismiss, paused]);

  return (
    <div
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="pointer-events-auto flex w-full max-w-sm animate-slide-up items-start gap-3 rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white shadow-overlay"
    >
      <Icon className={cn("mt-0.5 size-5 shrink-0", ICON_COLORS[item.tone])} aria-hidden="true" />
      <div className="min-w-0 flex-1 leading-relaxed">
        {item.title && <p className="font-bold">{item.title}</p>}
        <p className="text-slate-100">{item.message}</p>
      </div>
      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        className="-m-1.5 inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white"
        aria-label={t("common.close")}
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
