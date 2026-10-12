import { useId, useRef, useState, type ReactNode } from "react";
import { useI18n } from "@/i18n";
import { Button } from "./Button";
import { Dialog } from "./Dialog";
import { Input } from "./Input";

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  /** May return a promise; the dialog shows a spinner and stays open until it settles. */
  onConfirm: () => void | Promise<void>;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "primary" | "danger";
  /**
   * Typed confirmation for destructive actions: the confirm button stays
   * disabled until the user types exactly this text (e.g. the clinic link).
   */
  confirmText?: string;
  /** Error text to show (e.g. errorText(t, error) from a failed request). */
  error?: ReactNode;
  children?: ReactNode;
}

export function ConfirmDialog(props: ConfirmDialogProps) {
  // Remount on every open so the typed text and busy state start fresh.
  if (!props.open) return null;
  return <ConfirmDialogInner {...props} />;
}

function ConfirmDialogInner({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone = "danger",
  confirmText,
  error,
  children,
}: ConfirmDialogProps) {
  const { t, tRich } = useI18n();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const matches = confirmText === undefined || typed.trim() === confirmText;

  async function handleConfirm() {
    if (!matches || busy) return;
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      role="alertdialog"
      dismissible={!busy}
      initialFocusRef={confirmText !== undefined ? inputRef : cancelRef}
      footer={
        <>
          <Button ref={cancelRef} variant="outline" onClick={onClose} disabled={busy}>
            {cancelLabel ?? t("common.cancel")}
          </Button>
          <Button
            variant={tone === "danger" ? "danger" : "primary"}
            onClick={() => void handleConfirm()}
            disabled={!matches}
            loading={busy}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {children}
        {confirmText !== undefined && (
          <form
            className="flex flex-col gap-1.5"
            onSubmit={(event) => {
              event.preventDefault();
              void handleConfirm();
            }}
          >
            <label htmlFor={inputId} className="text-sm text-slate-700">
              {tRich("common.typeToConfirm", {
                text: (
                  <code
                    dir="ltr"
                    className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.8125rem] font-bold text-slate-900"
                  >
                    {confirmText}
                  </code>
                ),
              })}
            </label>
            <Input
              ref={inputRef}
              id={inputId}
              dir="ltr"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              aria-invalid={typed.length > 0 && !matches ? true : undefined}
            />
          </form>
        )}
        {error && (
          <p role="alert" className="text-sm font-medium text-red-700">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}
