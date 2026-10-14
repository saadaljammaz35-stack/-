import type { ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { Alert, Badge, Card, CardBody, CardHeader, SkeletonText } from "@/components/ui";
import { QueryError } from "@/components/layout/QueryError";
import { CopyButton } from "@/components/assistant/CopyButton";
import type { SystemStatus } from "@/components/assistant/model";
import { useI18n } from "@/i18n";
import { whatsappStatusView } from "./model";

export interface WhatsAppStatusCardProps {
  status: SystemStatus | undefined;
  loading: boolean;
  error: unknown;
  refreshing: boolean;
  onRefresh: () => void;
  /** Owners/admins also see the last error and the webhook URL. */
  canManage: boolean;
}

/** The connection as the server reports it. "Connected" only when status === "connected". */
export function WhatsAppStatusCard({
  status,
  loading,
  error,
  refreshing,
  onRefresh,
  canManage,
}: WhatsAppStatusCardProps) {
  const { t, formatDate } = useI18n();
  const wa = status?.whatsapp;
  const view = whatsappStatusView(wa?.status);
  const when = (value: string | null) =>
    value ? formatDate(value, { dateStyle: "medium", timeStyle: "short" }) : t("whatsapp.notYet");

  return (
    <Card as="section" aria-labelledby="wa-status-title" aria-busy={loading || undefined}>
      <CardHeader
        title={<span id="wa-status-title">{t("whatsapp.statusTitle")}</span>}
        actions={
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="inline-flex size-11 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
            aria-label={t("whatsapp.refreshStatus")}
            title={t("whatsapp.refreshStatus")}
          >
            <RefreshCw
              className={refreshing ? "size-5 animate-spin" : "size-5"}
              aria-hidden="true"
            />
          </button>
        }
      />
      <CardBody className="flex flex-col gap-4">
        {loading ? (
          <SkeletonText lines={4} />
        ) : error ? (
          <QueryError error={error} onRetry={onRefresh} retrying={refreshing} />
        ) : wa ? (
          <>
            <div aria-live="polite">
              <Badge tone={view.tone} dot className="text-sm">
                {t(view.label)}
              </Badge>
              <p className="mt-2 text-sm leading-relaxed text-slate-700">{t(view.text)}</p>
            </div>

            {canManage && wa.status === "error" && wa.lastError && (
              <Alert tone="error" title={t("whatsapp.lastErrorTitle")}>
                <span dir="auto" className="break-words">
                  {wa.lastError}
                </span>
              </Alert>
            )}

            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <Item label={t("whatsapp.phoneNumber")}>
                {wa.displayPhoneNumber ? (
                  <span dir="ltr">{wa.displayPhoneNumber}</span>
                ) : (
                  t("whatsapp.none")
                )}
              </Item>
              <Item label={t("whatsapp.verifiedName")}>
                {wa.verifiedName ? <span dir="auto">{wa.verifiedName}</span> : t("whatsapp.none")}
              </Item>
              <Item label={t("whatsapp.credentialsVerifiedAt")}>
                {when(wa.credentialsVerifiedAt)}
              </Item>
              <Item label={t("whatsapp.webhookVerifiedAt")}>{when(wa.webhookVerifiedAt)}</Item>
              <Item label={t("whatsapp.lastInboundAt")}>{when(wa.lastInboundAt)}</Item>
            </dl>

            {canManage && wa.webhookUrl && wa.status !== "disconnected" && (
              <div className="flex flex-col gap-1.5 border-t border-slate-100 pt-4">
                <p className="text-sm font-bold text-slate-800">{t("whatsapp.callbackUrl")}</p>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <code
                    dir="ltr"
                    className="block min-w-0 flex-1 rounded-xl bg-slate-50 px-3 py-2.5 font-mono text-[0.8125rem] break-all text-slate-800 ring-1 ring-slate-200"
                  >
                    {wa.webhookUrl}
                  </code>
                  <CopyButton
                    value={wa.webhookUrl}
                    label={t("whatsapp.copyCallbackUrl")}
                    className="shrink-0 self-start sm:self-auto"
                  />
                </div>
                <p className="text-[0.8125rem] text-slate-600">{t("whatsapp.callbackUrlHint")}</p>
              </div>
            )}

            {!canManage && (
              <p className="text-[0.8125rem] text-slate-600">{t("whatsapp.receptionistNote")}</p>
            )}
          </>
        ) : null}
      </CardBody>
    </Card>
  );
}

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-slate-500">{label}</dt>
      <dd className="mt-0.5 font-bold break-words text-slate-900">{children}</dd>
    </div>
  );
}
