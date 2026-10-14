import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui";
import { useI18n } from "@/i18n";
import { copyText } from "./clipboard";

export interface CopyButtonProps extends Omit<ButtonProps, "onClick" | "children"> {
  value: string;
  /** Accessible name, e.g. "Copy the webhook URL". The visible text stays "Copy". */
  label: string;
}

/** "Copy" button that confirms with "Copied" (announced politely) for two seconds. */
export function CopyButton({ value, label, variant = "outline", size = "sm", ...rest }: CopyButtonProps) {
  const { t } = useI18n();
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function copy() {
    const ok = await copyText(value);
    setState(ok ? "copied" : "failed");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState("idle"), 2000);
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => void copy()}
        aria-label={label}
        icon={
          state === "copied" ? (
            <Check className="size-4" aria-hidden="true" />
          ) : (
            <Copy className="size-4" aria-hidden="true" />
          )
        }
        {...rest}
      >
        {state === "copied" ? t("common.copied") : t("common.copy")}
      </Button>
      <span className="sr-only" role="status" aria-live="polite">
        {state === "copied" ? t("common.copied") : state === "failed" ? t("assistant.copyFailed") : ""}
      </span>
    </>
  );
}
