"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";

/** Two-step button for destructive actions */
export function ConfirmButton({
  onConfirm,
  children,
  confirmText = "تأكيد الحذف",
  size = "sm",
  variant = "danger",
  disabled,
  icon,
}: {
  onConfirm: () => void | Promise<void>;
  children: ReactNode;
  confirmText?: string;
  size?: "sm" | "md";
  variant?: "danger" | "ghost" | "outline";
  disabled?: boolean;
  icon?: ReactNode;
}) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!armed) {
    return (
      <Button type="button" size={size} variant={variant} disabled={disabled} icon={icon} onClick={() => setArmed(true)}>
        {children}
      </Button>
    );
  }
  return (
    <span className="inline-flex gap-1.5">
      <Button
        type="button"
        size={size}
        variant="dark"
        loading={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onConfirm();
          } finally {
            setBusy(false);
            setArmed(false);
          }
        }}
      >
        {confirmText}
      </Button>
      <Button type="button" size={size} variant="ghost" onClick={() => setArmed(false)} disabled={busy}>
        تراجع
      </Button>
    </span>
  );
}
