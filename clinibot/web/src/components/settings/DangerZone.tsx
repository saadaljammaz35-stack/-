import { useState } from "react";
import { LogOut, Trash2 } from "lucide-react";
import { useAuth } from "@/auth/useAuth";
import { ErrorInline } from "@/components/staff/ErrorDetails";
import { countOwners } from "@/components/staff/permissions";
import { useTeamMembers } from "@/components/staff/queries";
import { useExitClinic, useLeaveClinic } from "@/components/staff/useExitClinic";
import { Button, Card, CardBody, CardHeader, ConfirmDialog, useToast } from "@/components/ui";
import { useI18n } from "@/i18n";
import type { Org } from "@/org/context";
import { useDeleteOrganization } from "./queries";

/**
 * Owners: delete the clinic permanently (typed confirmation). Everyone: leave
 * the clinic, except its last owner.
 */
export function DangerZone({ org }: { org: Org }) {
  const { t } = useI18n();
  const toast = useToast();
  const { user } = useAuth();
  const members = useTeamMembers(org.id);
  const deleteOrg = useDeleteOrganization(org.id);
  const leave = useLeaveClinic();
  const exitClinic = useExitClinic();
  const [dialog, setDialog] = useState<"delete" | "leave" | null>(null);
  const [error, setError] = useState<unknown>(null);

  const me = members.data?.find((member) => member.user_id === user?.id);
  const isOwner = org.role === "owner";
  const lastOwner = isOwner && countOwners(members.data ?? []) <= 1;

  function open(kind: "delete" | "leave") {
    setError(null);
    setDialog(kind);
  }

  async function confirmDelete() {
    setError(null);
    try {
      await deleteOrg.mutateAsync(org.slug);
    } catch (caught) {
      setError(caught);
      return;
    }
    setDialog(null);
    toast.success(t("settings.deleted", { clinic: org.name }));
    await exitClinic(org.id);
  }

  async function confirmLeave() {
    if (!me) return;
    setError(null);
    try {
      await leave.mutateAsync(me.member_id);
    } catch (caught) {
      setError(caught);
      return;
    }
    setDialog(null);
    toast.success(t("staff.left", { clinic: org.name }));
    await exitClinic(org.id);
  }

  return (
    <Card as="section" aria-labelledby="danger-zone-title" className="border-red-200">
      <CardHeader
        title={
          <span id="danger-zone-title" className="text-red-800">
            {t("settings.dangerTitle")}
          </span>
        }
      />
      <CardBody className="flex flex-col divide-y divide-slate-100 py-0">
        {isOwner && (
          <div className="flex flex-col gap-3 py-5 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
            <div className="min-w-0">
              <h3 className="text-sm font-extrabold text-slate-900">{t("settings.deleteTitle")}</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                {t("settings.deleteText")}
              </p>
            </div>
            <Button
              variant="danger"
              onClick={() => open("delete")}
              icon={<Trash2 className="size-4" aria-hidden="true" />}
            >
              {t("settings.deleteButton")}
            </Button>
          </div>
        )}
        <div className="flex flex-col gap-3 py-5 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="min-w-0">
            <h3 className="text-sm font-extrabold text-slate-900">{t("settings.leaveTitle")}</h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              {lastOwner && members.data ? t("settings.leaveLastOwner") : t("settings.leaveText")}
            </p>
          </div>
          {!(lastOwner && members.data) && (
            <Button
              variant="outline"
              onClick={() => open("leave")}
              disabled={!me}
              icon={<LogOut className="flip-rtl size-4" aria-hidden="true" />}
            >
              {t("staff.leaveConfirm")}
            </Button>
          )}
        </div>
      </CardBody>

      <ConfirmDialog
        open={dialog === "delete"}
        onClose={() => setDialog(null)}
        onConfirm={confirmDelete}
        title={t("settings.deleteDialogTitle", { clinic: org.name })}
        description={t("settings.deleteDialogText")}
        confirmLabel={t("settings.deleteConfirm")}
        confirmText={org.slug}
        error={error !== null && <ErrorInline error={error} />}
      />
      <ConfirmDialog
        open={dialog === "leave"}
        onClose={() => setDialog(null)}
        onConfirm={confirmLeave}
        title={t("staff.leaveTitle", { clinic: org.name })}
        description={t("staff.leaveDescription")}
        confirmLabel={t("staff.leaveConfirm")}
        error={error !== null && <ErrorInline error={error} />}
      />
    </Card>
  );
}
