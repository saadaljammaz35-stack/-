"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CircleAlert, CircleCheck } from "lucide-react";

type Toast = { id: number; kind: "success" | "error"; text: string };
type Listener = (t: Toast) => void;

const listeners = new Set<Listener>();
let counter = 0;

function emit(kind: Toast["kind"], text: string) {
  const t = { id: ++counter, kind, text };
  listeners.forEach((l) => l(t));
}

export const toast = {
  success: (text: string) => emit("success", text),
  error: (text: string) => emit("error", text),
  /** Shows the result of a server action */
  result: (res: { ok: boolean; message?: string; error?: string }, fallback = "تم الحفظ.") =>
    res.ok ? emit("success", res.message ?? fallback) : emit("error", res.error ?? "حدث خطأ."),
};

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    const l: Listener = (t) => {
      setItems((prev) => [...prev.slice(-3), t]);
      setTimeout(() => setItems((prev) => prev.filter((p) => p.id !== t.id)), t.kind === "error" ? 6000 : 3500);
    };
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[200] flex flex-col items-center gap-2 px-4" aria-live="polite">
      <AnimatePresence>
        {items.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.96 }}
            role={t.kind === "error" ? "alert" : "status"}
            className={`pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl px-4 py-3 font-medium shadow-lift ${
              t.kind === "success" ? "bg-plum text-cream" : "bg-coral text-ink"
            }`}
          >
            {t.kind === "success" ? <CircleCheck className="size-5 shrink-0 text-sun" /> : <CircleAlert className="size-5 shrink-0" />}
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
