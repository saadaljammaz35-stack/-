import { useState } from "react";
import { KeyRound, PlugZap, Unplug } from "lucide-react";
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  useToast,
} from "@/components/ui";
import { useI18n } from "@/i18n";
import { ConnectError } from "./ConnectError";
import { qualityLabel } from "./model";
import {
  useDisconnect,
  useRotateVerifyToken,
  useTestConnection,
  type RevealedSecret,
} from "./queries";

/** Test the stored token, regenerate the verify token, or disconnect (owner/admin). */
export function ConnectionActions({
  orgId,
  slug,
  onRotated,
  onReplace,
}: {
  orgId: string;
  /** Typed to confirm disconnecting. */
  slug: string;
  onRotated: (secret: RevealedSecret) => void;
  onReplace: () => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const test = useTestConnection(orgId);
  const rotate = useRotateVerifyToken(orgId);
  const disconnect = useDisconnect(orgId);
  const [confirm, setConfirm] = useState<"rotate" | "disconnect" | null>(null);

  const busy = test.isPending || rotate.isPending || disconnect.isPending;

  return (
    <Card as="section" aria-labelledby="wa-actions-title">
      <CardHeader
        title={<span id="wa-actions-title">{t("whatsapp.actionsTitle")}</span>}
        description={t("whatsapp.actionsDescription")}
      />
      <CardBody className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button
            variant="secondary"
            onClick={() => {
              rotate.reset();
              disconnect.reset();
              test.mutate();
            }}
            loading={test.isPending}
            disabled={busy && !test.isPending}
            icon={<PlugZap className="size-4" aria-hidden="true" />}
          >
            {t("whatsapp.testConnection")}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              test.reset();
              rotate.reset();
              setConfirm("rotate");
            }}
            disabled={busy}
            icon={<KeyRound className="size-4" aria-hidden="true" />}
          >
            {t("whatsapp.regenerateToken")}
          </Button>
          <Button variant="outline" onClick={onReplace} disabled={busy}>
            {t("whatsapp.replaceCredentials")}
          </Button>
          <Button
            variant="ghost"
            className="text-red-700 hover:bg-red-50"
            onClick={() => {
              test.reset();
              disconnect.reset();
              setConfirm("disconnect");
            }}
            disabled={busy}
            icon={<Unplug className="size-4" aria-hidden="true" />}
          >
            {t("whatsapp.disconnect")}
          </Button>
        </div>

        <div aria-live="polite">
          {test.isSuccess && (
            <Alert tone="success" title={t("whatsapp.testOkTitle")}>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                <dt>{t("whatsapp.phoneNumber")}</dt>
                <dd dir="ltr" className="text-start font-bold">
                  {test.data.displayPhoneNumber ?? t("whatsapp.none")}
                </dd>
                <dt>{t("whatsapp.verifiedName")}</dt>
                <dd dir="auto" className="font-bold">
                  {test.data.verifiedName ?? t("whatsapp.none")}
                </dd>
                <dt>{t("whatsapp.qualityRating")}</dt>
                <dd className="font-bold">{t(qualityLabel(test.data.qualityRating))}</dd>
              </dl>
              <p className="mt-2">{t("whatsapp.testOkNote")}</p>
            </Alert>
          )}
        </div>
        {test.error ? <ConnectError error={test.error} context="test" /> : null}
        {disconnect.error && confirm === null ? (
          <ConnectError error={disconnect.error} context="other" />
        ) : null}
      </CardBody>

      <ConfirmDialog
        open={confirm === "rotate"}
        onClose={() => setConfirm(null)}
        tone="primary"
        title={t("whatsapp.rotateTitle")}
        description={t("whatsapp.rotateText")}
        confirmLabel={t("whatsapp.rotateConfirm")}
        onConfirm={async () => {
          try {
            const secret = await rotate.mutateAsync();
            setConfirm(null);
            onRotated(secret);
          } catch {
            // Shown inside the dialog.
          }
        }}
      >
        {rotate.error ? <ConnectError error={rotate.error} context="other" /> : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={confirm === "disconnect"}
        onClose={() => setConfirm(null)}
        title={t("whatsapp.disconnectTitle")}
        description={t("whatsapp.disconnectText")}
        confirmLabel={t("whatsapp.disconnectConfirm")}
        confirmText={slug}
        onConfirm={async () => {
          try {
            await disconnect.mutateAsync();
            setConfirm(null);
            toast.success(t("whatsapp.disconnected"));
          } catch {
            // Shown inside the dialog.
          }
        }}
      >
        <ul className="list-disc ps-5 text-sm leading-relaxed text-slate-700">
          <li>{t("whatsapp.disconnectEffect1")}</li>
          <li>{t("whatsapp.disconnectEffect2")}</li>
          <li>{t("whatsapp.disconnectEffect3")}</li>
        </ul>
        {disconnect.error ? <ConnectError error={disconnect.error} context="other" /> : null}
      </ConfirmDialog>
    </Card>
  );
}
