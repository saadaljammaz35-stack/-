import { LogOut, UserCog, UserMinus, Users } from "lucide-react";
import { Badge, Button, EmptyState } from "@/components/ui";
import { useI18n } from "@/i18n";
import { listFocusRow, listFocusTarget } from "@/lib/useListFocus";
import type { MemberRole } from "@/org/context";
import { removalPermission, roleChangePermission, type RoleChangeCheck } from "./permissions";
import { displayName, type Member } from "./queries";
import { RoleBadge } from "./RoleBadge";

interface MemberListProps {
  members: readonly Member[];
  ownerCount: number;
  callerRole: MemberRole | null;
  currentUserId: string | null;
  onChangeRole: (member: Member, check: Extract<RoleChangeCheck, { allowed: true }>) => void;
  onRemove: (member: Member) => void;
  onLeave: (member: Member) => void;
}

function initial(name: string): string {
  return Array.from(name.trim())[0]?.toUpperCase() ?? "?";
}

export function MemberList({
  members,
  ownerCount,
  callerRole,
  currentUserId,
  onChangeRole,
  onRemove,
  onLeave,
}: MemberListProps) {
  const { t, formatDate } = useI18n();
  const caller = { role: callerRole, userId: currentUserId };

  if (members.length === 0) {
    return <EmptyState icon={Users} title={t("staff.emptyTitle")} text={t("staff.emptyText")} />;
  }

  return (
    <ul className="divide-y divide-slate-100" aria-label={t("staff.membersCaption")}>
      {members.map((member) => {
        const name = displayName(member);
        const self = member.user_id === currentUserId;
        const roleCheck = roleChangePermission(caller, member, ownerCount);
        const removal = removalPermission(caller, member, ownerCount);
        const isLastOwner = member.role === "owner" && ownerCount <= 1;
        const showLastOwnerNote = isLastOwner && (self || callerRole === "owner");
        const hasActions = roleCheck.allowed || removal.allowed;

        return (
          <li
            key={member.member_id}
            {...listFocusRow(member.member_id)}
            className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:gap-4 sm:px-6"
          >
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <span
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-base font-extrabold text-primary"
                aria-hidden="true"
              >
                {initial(name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="min-w-0 font-bold break-words text-slate-900">{name}</span>
                  {self && <Badge tone="success">{t("staff.you")}</Badge>}
                  <RoleBadge role={member.role} />
                </p>
                {member.full_name?.trim() && (
                  <p className="mt-0.5 truncate text-sm text-slate-600">
                    <span dir="ltr">{member.email}</span>
                  </p>
                )}
                <p className="mt-0.5 text-xs text-slate-500">
                  {t("staff.joined", { date: formatDate(member.created_at) })}
                </p>
                {showLastOwnerNote && (
                  <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-slate-600">
                    {t("staff.lastOwnerNote")}
                  </p>
                )}
              </div>
            </div>
            {hasActions && (
              <div
                role="group"
                aria-label={t("staff.actionsFor", { name })}
                className="flex flex-wrap gap-2 ps-13 sm:shrink-0 sm:ps-0"
              >
                {roleCheck.allowed && (
                  <Button
                    {...listFocusTarget}
                    variant="outline"
                    size="sm"
                    icon={<UserCog className="size-4" aria-hidden="true" />}
                    onClick={() => onChangeRole(member, roleCheck)}
                  >
                    {t("staff.changeRole")}
                  </Button>
                )}
                {removal.allowed && removal.kind === "remove" && (
                  <Button
                    {...listFocusTarget}
                    variant="outline"
                    size="sm"
                    icon={<UserMinus className="size-4" aria-hidden="true" />}
                    onClick={() => onRemove(member)}
                  >
                    {t("staff.remove")}
                  </Button>
                )}
                {removal.allowed && removal.kind === "leave" && (
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<LogOut className="flip-rtl size-4" aria-hidden="true" />}
                    onClick={() => onLeave(member)}
                  >
                    {t("staff.leave")}
                  </Button>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
