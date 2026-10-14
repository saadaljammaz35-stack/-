import { useI18n } from "@/i18n";

/** The exact clicks in the Meta app after CliniBot verified the credentials. */
export function WebhookSteps() {
  const { t, tRich } = useI18n();
  return (
    <ol className="flex list-decimal flex-col gap-1.5 ps-6 text-sm leading-relaxed marker:font-bold">
      <li>
        {tRich("whatsapp.webhookStep1", {
          path: <strong dir="ltr">WhatsApp → Configuration → Webhook → Edit</strong>,
        })}
      </li>
      <li>
        {tRich("whatsapp.webhookStep2", {
          callback: <strong dir="ltr">Callback URL</strong>,
          verify: <strong dir="ltr">Verify token</strong>,
        })}
      </li>
      <li>{tRich("whatsapp.webhookStep3", { button: <strong dir="ltr">Verify and save</strong> })}</li>
      <li>
        {tRich("whatsapp.webhookStep4", {
          field: (
            <code dir="ltr" className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.8125rem] font-bold text-slate-900">
              messages
            </code>
          ),
          fields: <strong dir="ltr">Webhook fields</strong>,
        })}
      </li>
      <li>{t("whatsapp.webhookStep5")}</li>
    </ol>
  );
}
