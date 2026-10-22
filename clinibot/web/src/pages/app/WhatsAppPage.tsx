import { useState } from "react";
import { Hourglass } from "lucide-react";
import { Alert, Card, CardBody, CardHeader, PageHeader } from "@/components/ui";
import { useSystemStatus } from "@/components/assistant/queries";
import { ConnectionActions } from "@/components/whatsapp/ConnectionActions";
import { CredentialsForm } from "@/components/whatsapp/CredentialsForm";
import type { RevealedSecret } from "@/components/whatsapp/queries";
import { RevealPanel } from "@/components/whatsapp/RevealPanel";
import { SetupChecklist } from "@/components/whatsapp/SetupChecklist";
import { TemplateCard } from "@/components/whatsapp/TemplateCard";
import { WebhookSteps } from "@/components/whatsapp/WebhookSteps";
import { WhatsAppStatusCard } from "@/components/whatsapp/WhatsAppStatusCard";
import { useI18n } from "@/i18n";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import { canManage } from "@/org/roles";
import { useCurrentOrg } from "@/org/useOrg";

/** While Meta's webhook check is pending, look again every 15 seconds so "Connected" appears by itself. */
const WAITING_POLL_MS = 15_000;
/** Connected but no message received yet: look again every minute so the warning clears by itself. */
const NO_INBOUND_POLL_MS = 60_000;

/** /app/whatsapp — connection status for everyone; setup and management for owners/admins. */
export default function WhatsAppPage() {
  const { t } = useI18n();
  const org = useCurrentOrg();
  const manager = canManage(org.role);
  const status = useSystemStatus(org.id, {
    refetchInterval: (data) =>
      data?.whatsapp.status === "credentials_verified"
        ? WAITING_POLL_MS
        : data?.whatsapp.status === "connected" && !data.whatsapp.lastInboundAt
          ? NO_INBOUND_POLL_MS
          : false,
  });
  // Both are tied to the clinic they were made for, so a clinic switch never shows another
  // clinic's one-time verify token or keeps its replace form open (the shell also remounts).
  const [revealed, setRevealed] = useState<{
    orgId: string;
    secret: RevealedSecret;
    reason: "saved" | "rotated";
  } | null>(null);
  const [replacingOrg, setReplacingOrg] = useState<string | null>(null);
  const reveal = revealed?.orgId === org.id ? revealed : null;
  const replacing = replacingOrg === org.id;
  const setReveal = (value: { secret: RevealedSecret; reason: "saved" | "rotated" } | null) =>
    setRevealed(value && { ...value, orgId: org.id });
  const setReplacing = (value: boolean) => setReplacingOrg(value ? org.id : null);
  useDocumentTitle(t("whatsapp.title"));

  const wa = status.data?.whatsapp;
  const refresh = () => void status.refetch();

  return (
    <>
      <PageHeader title={t("whatsapp.title")} description={t("whatsapp.description")} />

      {manager && reveal && (
        <RevealPanel
          secret={reveal.secret}
          reason={reveal.reason}
          onDone={() => {
            setReveal(null);
            // The panel takes its focused Done button along: land on the connection status.
            requestAnimationFrame(() =>
              (
                document.getElementById("wa-status-title") ?? document.getElementById("main")
              )?.focus(),
            );
          }}
        />
      )}

      <div className="flex flex-col gap-6">
        <WhatsAppStatusCard
          status={status.data}
          loading={status.isPending}
          error={status.error}
          refreshing={status.isFetching}
          onRefresh={refresh}
          canManage={manager}
        />

        {manager && wa && (
          <>
            {wa.status === "credentials_verified" && !reveal && (
              <Card as="section" aria-labelledby="wa-waiting-title">
                <CardHeader
                  title={
                    <span id="wa-waiting-title" className="inline-flex items-center gap-2">
                      <Hourglass className="size-5 text-amber-600" aria-hidden="true" />
                      {t("whatsapp.waitingTitle")}
                    </span>
                  }
                  description={t("whatsapp.waitingDescription")}
                />
                <CardBody className="flex flex-col gap-3">
                  <WebhookSteps />
                  <p className="text-[0.8125rem] leading-relaxed text-slate-600">
                    {t("whatsapp.waitingLostToken")}
                  </p>
                </CardBody>
              </Card>
            )}

            {/* "Connected" only means Meta verified the callback URL; messages need step 4 too. */}
            {wa.status === "connected" && !wa.lastInboundAt && !reveal && (
              <Alert tone="warning" title={t("whatsapp.noInboundTitle")}>
                <p>{t("whatsapp.noInboundText")}</p>
                <div className="mt-3">
                  <WebhookSteps />
                </div>
              </Alert>
            )}

            {wa.status === "disconnected" ? (
              <>
                <SetupChecklist defaultOpen />
                <CredentialsForm
                  key={org.id}
                  orgId={org.id}
                  replacing={false}
                  encryptionConfigured={status.data?.encryptionConfigured ?? false}
                  onSaved={(secret) => {
                    setReplacing(false);
                    setReveal({ secret, reason: "saved" });
                  }}
                />
              </>
            ) : (
              <>
                <ConnectionActions
                  orgId={org.id}
                  slug={org.slug}
                  onRotated={(secret) => setReveal({ secret, reason: "rotated" })}
                  onReplace={() => setReplacing(true)}
                />
                {replacing && (
                  <CredentialsForm
                    key={org.id}
                    orgId={org.id}
                    replacing
                    encryptionConfigured={status.data?.encryptionConfigured ?? false}
                    onSaved={(secret) => {
                      setReplacing(false);
                      setReveal({ secret, reason: "saved" });
                    }}
                    onCancel={() => setReplacing(false)}
                  />
                )}
                <SetupChecklist defaultOpen={false} />
              </>
            )}

            <TemplateCard orgId={org.id} />
          </>
        )}
      </div>
    </>
  );
}
