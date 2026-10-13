import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { BellRing, CircleCheck } from "lucide-react";
import { Alert, Button, Card, CardBody, CardHeader } from "@/components/ui";
import { useI18n } from "@/i18n";
import { isApiError } from "@/lib/api";
import { errorReference, errorText } from "@/lib/errors";
import { formatDateTime } from "@/components/dashboard/time";
import type { AppointmentDetailRow } from "./model";
import { useNotifyCustomer, type NotifyResult } from "./queries";

function PhoneLink({ phone }: { phone: string }) {
  return (
    <a href={`tel:${phone}`} dir="ltr" className="font-bold underline">
      {phone}
    </a>
  );
}

function Reference({ error }: { error: unknown }) {
  const { tRich } = useI18n();
  const reference = errorReference(error);
  if (!reference) return null;
  return (
    <p className="mt-1 text-xs opacity-80">
      {tRich("errors.reference", {
        id: (
          <span dir="ltr" className="font-mono select-all">
            {reference}
          </span>
        ),
      })}
    </p>
  );
}

/** What went wrong, in words a receptionist can act on. */
function NotifyError({ error, phone }: { error: unknown; phone: string }) {
  const { t, tRich } = useI18n();
  const whatsappLink = (
    <Link to="/app/whatsapp" className="font-bold underline">
      {t("appointments.whatsappPageLink")}
    </Link>
  );
  const code = isApiError(error) ? error.code : null;
  let body: ReactNode = errorText(t, error);
  if (code === "no_channel") {
    body = tRich("appointments.notifyNoChannel", { phone: <PhoneLink phone={phone} /> });
  } else if (code === "template_required") {
    body = tRich("appointments.notifyTemplateRequired", { link: whatsappLink });
  } else if (code === "whatsapp_not_connected") {
    body = tRich("appointments.notifyNotConnected", { link: whatsappLink });
  } else if (code === "customer_opted_out") {
    body = tRich("appointments.notifyOptedOut", { phone: <PhoneLink phone={phone} /> });
  } else if (code === "not_confirmed") {
    body = t("appointments.notifyNotConfirmed");
  } else if (isApiError(error) && error.status === 502) {
    const details = (error.details ?? {}) as Record<string, unknown>;
    const metaCode =
      typeof details.meta_code === "number" || typeof details.meta_code === "string"
        ? String(details.meta_code)
        : typeof details.error_code === "string"
          ? details.error_code
          : null;
    body = metaCode
      ? t("appointments.notifyProviderErrorCode", { code: metaCode })
      : t("appointments.notifyProviderError");
  }
  return (
    <Alert tone="error" title={t("appointments.notifyFailedTitle")}>
      <p>{body}</p>
      <Reference error={error} />
    </Alert>
  );
}

export function NotifyCard({ orgId, request }: { orgId: string; request: AppointmentDetailRow }) {
  const { t, lang } = useI18n();
  const notify = useNotifyCustomer(orgId, request.id);
  const [result, setResult] = useState<NotifyResult | null>(null);
  const [error, setError] = useState<unknown>(null);
  const confirmed = request.status === "confirmed";
  const hasChannel = request.conversation_id !== null && request.conversation !== null;
  const canNotify = confirmed && !request.customer_notified_at && hasChannel;

  function send() {
    setError(null);
    setResult(null);
    notify.mutate(undefined, {
      onSuccess: setResult,
      onError: setError,
    });
  }

  let state: ReactNode;
  if (!confirmed) {
    state = (
      <p className="text-sm text-slate-600">
        {request.status === "completed" || request.status === "cancelled"
          ? t("appointments.notifyClosed")
          : t("appointments.notifyNeedsConfirm")}
      </p>
    );
  } else if (request.customer_notified_at) {
    state = (
      <p className="flex items-start gap-2 text-sm text-slate-800">
        <CircleCheck className="mt-0.5 size-5 shrink-0 text-accent-strong" aria-hidden="true" />
        <span>
          {t("appointments.notifiedAt", {
            time: formatDateTime(lang, request.customer_notified_at),
          })}
        </span>
      </p>
    );
  } else if (!hasChannel) {
    state = (
      <Alert tone="info">
        {request.source === "dashboard"
          ? t("appointments.notifyManualRequest")
          : t("appointments.notifyConversationGone")}{" "}
        <PhoneLink phone={request.customer_phone} />
      </Alert>
    );
  } else {
    state = (
      <p className="text-sm text-slate-600">
        {request.conversation?.channel === "whatsapp"
          ? t("appointments.notifyExplainWhatsapp")
          : t("appointments.notifyExplainWeb")}
      </p>
    );
  }

  return (
    <Card as="section" aria-labelledby="notify-title">
      <CardHeader title={<span id="notify-title">{t("appointments.notifyTitle")}</span>} />
      <CardBody className="flex flex-col gap-3">
        {state}
        <div aria-live="polite" className="flex flex-col gap-3">
          {result &&
            (result.notified_at ? (
              <Alert tone="success">
                {result.channel === "whatsapp"
                  ? t("appointments.notifySentWhatsapp")
                  : t("appointments.notifySentWeb")}
              </Alert>
            ) : (
              <Alert tone="warning">{t("appointments.notifyTimeChanged")}</Alert>
            ))}
          {error !== null && <NotifyError error={error} phone={request.customer_phone} />}
        </div>
        {confirmed && !request.customer_notified_at && (
          <Button
            onClick={send}
            loading={notify.isPending}
            disabled={!canNotify}
            icon={<BellRing className="size-4" aria-hidden="true" />}
            className="self-start"
          >
            {notify.isPending ? t("appointments.notifySending") : t("appointments.notifyButton")}
          </Button>
        )}
      </CardBody>
    </Card>
  );
}
