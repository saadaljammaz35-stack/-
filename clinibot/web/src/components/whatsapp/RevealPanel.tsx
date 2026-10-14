import { useEffect, useId, useRef } from "react";
import { KeyRound } from "lucide-react";
import { Alert, Button } from "@/components/ui";
import { CopyButton } from "@/components/assistant/CopyButton";
import { useI18n } from "@/i18n";
import type { RevealedSecret } from "./queries";
import { WebhookSteps } from "./WebhookSteps";

/**
 * Shows the webhook URL and verify token right after save / regenerate. The
 * token lives only in this component's props: it is never stored, and once
 * the panel is closed it cannot be shown again (only regenerated).
 */
export function RevealPanel({
  secret,
  reason,
  onDone,
}: {
  secret: RevealedSecret;
  reason: "saved" | "rotated";
  onDone: () => void;
}) {
  const { t } = useI18n();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  const urlId = useId();
  const tokenId = useId();

  // Move focus here so keyboard and screen-reader users land on the one-time values.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <section
      aria-labelledby={titleId}
      className="mb-6 rounded-2xl border-2 border-emerald-300 bg-white shadow-card"
    >
      <div className="flex items-start gap-3 border-b border-emerald-100 bg-mint/60 px-5 py-4 sm:px-6">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-accent-strong ring-1 ring-emerald-200">
          <KeyRound className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2
            ref={headingRef}
            id={titleId}
            tabIndex={-1}
            className="text-lg font-extrabold text-slate-900 focus:outline-none"
          >
            {reason === "saved" ? t("whatsapp.revealSavedTitle") : t("whatsapp.revealRotatedTitle")}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-700">
            {reason === "saved" ? t("whatsapp.revealSavedText") : t("whatsapp.revealRotatedText")}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-5 px-5 py-5 sm:px-6">
        <Alert tone="warning" title={t("whatsapp.revealWarningTitle")}>
          {t("whatsapp.revealWarning")}
        </Alert>

        <SecretRow
          id={urlId}
          label={t("whatsapp.callbackUrl")}
          value={secret.webhookUrl}
          copyLabel={t("whatsapp.copyCallbackUrl")}
        />
        <SecretRow
          id={tokenId}
          label={t("whatsapp.verifyToken")}
          value={secret.verifyToken}
          copyLabel={t("whatsapp.copyVerifyToken")}
        />

        {secret.appSubscribed === false && (
          <Alert tone="warning" title={t("whatsapp.appNotSubscribedTitle")}>
            {t("whatsapp.appNotSubscribedText")}
          </Alert>
        )}

        <div>
          <h3 className="mb-2 text-sm font-extrabold text-slate-900">{t("whatsapp.webhookStepsTitle")}</h3>
          <WebhookSteps />
        </div>

        <div className="flex justify-end">
          <Button onClick={onDone}>{t("whatsapp.revealDone")}</Button>
        </div>
      </div>
    </section>
  );
}

function SecretRow({
  id,
  label,
  value,
  copyLabel,
}: {
  id: string;
  label: string;
  value: string;
  copyLabel: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-bold text-slate-800">
        {label}
      </label>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          id={id}
          readOnly
          dir="ltr"
          value={value}
          onFocus={(event) => event.currentTarget.select()}
          spellCheck={false}
          autoComplete="off"
          className="block min-h-11 w-full min-w-0 rounded-xl border border-slate-300 bg-slate-50 px-3.5 font-mono text-base text-slate-900 focus:border-primary focus:ring-3 focus:ring-primary/20 focus:outline-none"
        />
        <CopyButton value={value} label={copyLabel} className="shrink-0 self-start sm:self-auto" />
      </div>
    </div>
  );
}
