import { useId, useState } from "react";
import { Alert, Button, Checkbox, Dialog } from "@/components/ui";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/cn";
import type { MemberRole } from "@/org/context";
import { ROLE_LABELS } from "@/org/roles";
import { ErrorDetails } from "./ErrorDetails";
import { displayName, useUpdateMemberRole, type Member } from "./queries";
import { ROLE_HINTS } from "./roleText";

interface RoleChangeDialogProps {
  orgId: string;
  /** The member being changed; null closes the dialog. */
  member: Member | null;
  /** True when the member is the signed-in user (owners changing their own role). */
  self: boolean;
  options: MemberRole[];
  onClose: () => void;
  onChanged: (member: Member, role: MemberRole) => void | Promise<void>;
}

export function RoleChangeDialog(props: RoleChangeDialogProps) {
  if (!props.member) return null;
  return <RoleChangeForm {...props} member={props.member} />;
}

function RoleChangeForm({
  orgId,
  member,
  self,
  options,
  onClose,
  onChanged,
}: RoleChangeDialogProps & { member: Member }) {
  const { t } = useI18n();
  const formId = useId();
  const update = useUpdateMemberRole(orgId);
  const [role, setRole] = useState<MemberRole>(options[0] ?? member.role);
  const [understood, setUnderstood] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const name = displayName(member);
  const losingOwner = self && member.role === "owner" && role !== "owner";
  const canSave = role !== member.role && (!losingOwner || understood);

  async function submit() {
    if (!canSave) return;
    setError(null);
    try {
      await update.mutateAsync({ memberId: member.member_id, role });
      await onChanged(member, role);
      onClose();
    } catch (caught) {
      setError(caught);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t("staff.roleDialogTitle", { name })}
      description={t("staff.roleDialogDescription", { role: t(ROLE_LABELS[member.role]) })}
      dismissible={!update.isPending}
      role={self ? "alertdialog" : "dialog"}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={update.isPending}>
            {t("common.cancel")}
          </Button>
          <Button
            type="submit"
            form={formId}
            variant={losingOwner ? "danger" : "primary"}
            disabled={!canSave}
            loading={update.isPending}
          >
            {t("staff.saveRole")}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-bold text-slate-800">
            {t("staff.newRoleLabel")}
          </legend>
          {options.map((option) => (
            <label
              key={option}
              className={cn(
                "flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 transition-colors",
                role === option
                  ? "border-primary bg-primary-soft"
                  : "border-slate-200 hover:border-slate-300",
              )}
            >
              <input
                type="radio"
                name={`${formId}-role`}
                value={option}
                checked={role === option}
                onChange={() => {
                  setRole(option);
                  setUnderstood(false);
                }}
                className="mt-0.5 size-5 shrink-0 accent-primary"
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-bold text-slate-900">{t(ROLE_LABELS[option])}</span>
                <span className="text-[0.8125rem] leading-relaxed text-slate-600">
                  {t(ROLE_HINTS[option])}
                </span>
              </span>
            </label>
          ))}
        </fieldset>

        {role === "owner" && !self && <Alert tone="info">{t("staff.promoteOwnerNote")}</Alert>}

        {losingOwner && (
          <div className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm leading-relaxed font-medium text-red-900">
              {t("staff.selfChangeWarning")}
            </p>
            <Checkbox
              label={t("staff.selfChangeConfirm")}
              checked={understood}
              onChange={(event) => setUnderstood(event.target.checked)}
            />
          </div>
        )}

        <div aria-live="assertive">{error !== null && <ErrorDetails error={error} />}</div>
      </form>
    </Dialog>
  );
}
