import { useState } from "react";
import { UserPlus } from "lucide-react";
import { Link, Navigate, Route, Routes } from "react-router";
import { useAuth } from "@/auth/useAuth";
import { useEntitlements } from "@/components/billing/queries";
import { UsageMeter } from "@/components/billing/UsageMeter";
import { QueryError } from "@/components/layout/QueryError";
import { ErrorInline } from "@/components/staff/ErrorDetails";
import { InviteDialog } from "@/components/staff/InviteDialog";
import { MemberList } from "@/components/staff/MemberList";
import {
  canInvite,
  countOwners,
  invitableRoles,
  type RoleChangeCheck,
} from "@/components/staff/permissions";
import {
  displayName,
  useRemoveMember,
  useTeamMembers,
  type InviteResult,
  type Member,
} from "@/components/staff/queries";
import { RoleChangeDialog } from "@/components/staff/RoleChangeDialog";
import { RolesTable } from "@/components/staff/RolesTable";
import { useExitClinic, useLeaveClinic } from "@/components/staff/useExitClinic";
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  PageHeader,
  Skeleton,
  useToast,
} from "@/components/ui";
import { useI18n } from "@/i18n";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import type { MemberRole } from "@/org/context";
import { ROLE_LABELS } from "@/org/roles";
import { useCurrentOrg, useOrg } from "@/org/useOrg";

/** /app/staff: the clinic's team, invitations, roles and the role permissions table. */
export default function StaffPage() {
  return (
    <Routes>
      <Route index element={<TeamPage />} />
      <Route path="*" element={<Navigate to="/app/staff" replace />} />
    </Routes>
  );
}

type PendingRemoval = { member: Member; kind: "remove" | "leave" };

function TeamPage() {
  const { t, formatNumber } = useI18n();
  const org = useCurrentOrg();
  const { refresh } = useOrg();
  const { user } = useAuth();
  const toast = useToast();
  useDocumentTitle(t("staff.title"));

  const members = useTeamMembers(org.id);
  const entitlements = useEntitlements(org.id);
  const removeMember = useRemoveMember(org.id);
  const leaveClinic = useLeaveClinic();
  const exitClinic = useExitClinic();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteResult, setInviteResult] = useState<(InviteResult & { email: string }) | null>(null);
  const [roleTarget, setRoleTarget] = useState<{
    member: Member;
    check: Extract<RoleChangeCheck, { allowed: true }>;
  } | null>(null);
  const [removal, setRemoval] = useState<PendingRemoval | null>(null);
  const [removalError, setRemovalError] = useState<unknown>(null);

  const role = org.role;
  const userId = user?.id ?? null;
  const list = members.data ?? [];
  const ownerCount = countOwners(list);
  const ent = entitlements.data;
  const seatsFull = ent !== undefined && ent.seatsLimit !== null && ent.seatsUsed >= ent.seatsLimit;
  const mayInvite = canInvite(role);

  function openInvite() {
    setInviteResult(null);
    setInviteOpen(true);
  }

  async function confirmRemoval() {
    if (!removal) return;
    setRemovalError(null);
    const { member, kind } = removal;
    try {
      if (kind === "leave") {
        const clinic = org.name;
        await leaveClinic.mutateAsync(member.member_id);
        setRemoval(null);
        toast.success(t("staff.left", { clinic }));
        await exitClinic(org.id);
      } else {
        await removeMember.mutateAsync(member.member_id);
        setRemoval(null);
        toast.success(t("staff.removed", { name: displayName(member) }));
      }
    } catch (error) {
      setRemovalError(error);
    }
  }

  async function roleChanged(member: Member, next: MemberRole) {
    toast.success(t("staff.roleChanged", { name: displayName(member), role: t(ROLE_LABELS[next]) }));
    // Your own role changed: the whole app must reflect the new permissions.
    if (member.user_id === userId) await refresh().catch(() => {});
  }

  return (
    <>
      <PageHeader
        title={t("staff.title")}
        description={t("staff.description")}
        actions={
          mayInvite && (
            <Button
              onClick={openInvite}
              disabled={seatsFull}
              icon={<UserPlus className="size-5" aria-hidden="true" />}
            >
              {t("staff.inviteButton")}
            </Button>
          )
        }
      />

      <div className="flex flex-col gap-6">
        <div aria-live="polite" className="empty:hidden">
          {inviteResult && (
            <Alert tone="success" onDismiss={() => setInviteResult(null)}>
              <span className="break-words">
                {inviteResult.invited
                  ? t("staff.invitedEmailSent", { email: inviteResult.email })
                  : t("staff.invitedExisting", { email: inviteResult.email })}
              </span>
            </Alert>
          )}
        </div>

        {role === "receptionist" && <Alert tone="info">{t("staff.noticeReceptionist")}</Alert>}
        {role === "admin" && <Alert tone="info">{t("staff.noticeAdmin")}</Alert>}

        <Card as="section" aria-labelledby="seats-title">
          <CardBody>
            <h2 id="seats-title" className="sr-only">
              {t("staff.seatsLabel")}
            </h2>
            {entitlements.error ? (
              <p className="text-sm text-slate-600">{t("staff.seatsError")}</p>
            ) : !ent ? (
              <div className="flex flex-col gap-3" aria-hidden="true">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-2.5 w-full" />
              </div>
            ) : (
              <UsageMeter label={t("staff.seatsLabel")} used={ent.seatsUsed} limit={ent.seatsLimit}>
                {ent.seatsLimit === null ? (
                  <p className="text-[0.8125rem] text-slate-600">{t("staff.seatsNoPlan")}</p>
                ) : seatsFull && mayInvite ? (
                  <p className="text-[0.8125rem] leading-relaxed text-amber-900">
                    {t("staff.seatsFull")}{" "}
                    <Link
                      to="/app/billing"
                      className="font-bold underline underline-offset-2 hover:no-underline"
                    >
                      {t("staff.viewPlans")}
                    </Link>
                  </p>
                ) : (
                  <p className="text-[0.8125rem] text-slate-600">{t("staff.seatsHint")}</p>
                )}
              </UsageMeter>
            )}
          </CardBody>
        </Card>

        <Card as="section" aria-labelledby="members-title" aria-busy={members.isPending || undefined}>
          <CardHeader
            title={<span id="members-title">{t("staff.membersTitle")}</span>}
            description={
              members.data ? t("staff.membersCount", { count: formatNumber(list.length) }) : undefined
            }
          />
          {members.error ? (
            <div className="p-5 sm:p-6">
              <QueryError error={members.error} onRetry={() => void members.refetch()} />
            </div>
          ) : members.isPending ? (
            <div className="flex flex-col gap-4 p-5 sm:p-6" aria-hidden="true">
              {[0, 1, 2].map((index) => (
                <div key={index} className="flex items-center gap-3">
                  <Skeleton className="size-10 rounded-full" />
                  <div className="flex flex-1 flex-col gap-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-56" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <MemberList
              members={list}
              ownerCount={ownerCount}
              callerRole={role}
              currentUserId={userId}
              onChangeRole={(member, check) => setRoleTarget({ member, check })}
              onRemove={(member) => {
                setRemovalError(null);
                setRemoval({ member, kind: "remove" });
              }}
              onLeave={(member) => {
                setRemovalError(null);
                setRemoval({ member, kind: "leave" });
              }}
            />
          )}
        </Card>

        <RolesTable />
      </div>

      <InviteDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        orgId={org.id}
        roles={invitableRoles(role)}
        onInvited={setInviteResult}
      />

      <RoleChangeDialog
        orgId={org.id}
        member={roleTarget?.member ?? null}
        self={roleTarget?.check.self ?? false}
        options={roleTarget?.check.options ?? []}
        onClose={() => setRoleTarget(null)}
        onChanged={roleChanged}
      />

      <ConfirmDialog
        open={removal !== null}
        onClose={() => setRemoval(null)}
        onConfirm={confirmRemoval}
        title={
          removal?.kind === "leave"
            ? t("staff.leaveTitle", { clinic: org.name })
            : t("staff.removeTitle", { name: removal ? displayName(removal.member) : "" })
        }
        description={
          removal?.kind === "leave" ? t("staff.leaveDescription") : t("staff.removeDescription")
        }
        confirmLabel={removal?.kind === "leave" ? t("staff.leaveConfirm") : t("staff.removeConfirm")}
        error={removalError !== null && <ErrorInline error={removalError} />}
      />
    </>
  );
}
