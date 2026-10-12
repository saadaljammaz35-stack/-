import { createContext, use } from "react";

export type ToastTone = "success" | "error" | "info";

export interface ToastOptions {
  tone?: ToastTone;
  title?: string;
  message: string;
  /** Milliseconds; default 5s (8s for errors). 0 keeps it until dismissed. */
  duration?: number;
}

export interface ToastItem extends Required<Omit<ToastOptions, "title">> {
  id: number;
  title: string | undefined;
}

export interface ToastApi {
  show: (options: ToastOptions) => number;
  success: (message: string) => number;
  error: (message: string) => number;
  info: (message: string) => number;
  dismiss: (id: number) => void;
}

export const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const api = use(ToastContext);
  if (!api) throw new Error("useToast() must be used inside <ToastProvider>");
  return api;
}
