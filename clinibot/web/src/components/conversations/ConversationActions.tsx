import { useState } from "react";
import { useNavigate } from "react-router";
import {
  Bot,
  CheckCircle2,
  ChevronDown,
  Hand,
  RotateCcw,
  Trash2,
  UserRound,
  UserRoundX,
} from "lucide-react";
import {
  Button,
  ConfirmDialog,
  Menu,
  buttonClasses,
  useToast,
  type MenuItem,
} from "@/components/ui";
import { useAuth } from "@/auth/useAuth";
import { useI18n, type MessageKey } from "@/i18n";
import { errorText } from "@/lib/errors";
import { canManage } from "@/org/roles";
import type { MemberRole } from "@/org/context";
import { memberName, type OrgMember } from "@/components/dashboard/members";
import type { ConversationRow } from "./model";
import { useDeleteConversation, useUpdateConversation, type ConversationPatch } from "./queries";

export function ConversationActions({
  orgId,
  conversation,
  role,
  members,
  membersError = null,
  onRetryMembers,
  listSearch,
  canReply,
}: {
  orgId: string;
  conversation: ConversationRow;
  role: MemberRole | null;
  /** The team; undefined while it loads or when it failed (names are then unknown). */
  members: readonly OrgMember[] | undefined;
  membersError?: unknown;
  onRetryMembers?: () => void;
  /** The list's filters (?tab=…), kept when going back after a delete. */
  listSearch: string;
  /** Whether the assistant answers patients in this clinic at all; null while unknown. */
  canReply: boolean | null;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const update = useUpdateConversation(orgId, conversation.id);
  const remove = useDeleteConversation(orgId, conversation.id);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const myId = user?.id ?? null;
  const manager = canManage(role);

  function change(patch: ConversationPatch, success: MessageKey) {
    update.mutate(patch, { onSuccess: () => toast.success(t(success)) });
  }

  function resumeAssistant() {
    const patch: ConversationPatch = { ai_paused: false };
    // Leave the reception queue only when the assistant can take the conversation back: while
    // it is off, unconfigured or out of plan the patient still needs a person (and the pipeline
    // would put it back on the next message). A closed conversation keeps its own Reopen.
    if (canReply === true && conversation.status === "awaiting_human") patch.status = "open";
    change(
      patch,
      canReply === true
        ? "conversations.toastResumed"
        : canReply === false
          ? "conversations.toastResumedAssistantOff"
          : "conversations.toastResumedUnknown",
    );
  }

  const assignee = conversation.assigned_to
    ? members?.find((member) => member.user_id === conversation.assigned_to)
    : undefined;
  // Without the team list nobody can be called a former member: their name is just unknown.
  const assigneeUnknown =
    Boolean(conversation.assigned_to) && conversation.assigned_to !== myId && !members;
  const assigneeLabel = !conversation.assigned_to
    ? t("conversations.unassigned")
    : conversation.assigned_to === myId
      ? t("conversations.assigneeMe")
      : assignee
        ? memberName(assignee)
        : members
          ? t("conversations.formerMember")
          : t("dashboard.nameUnavailable");

  const assignItems: MenuItem[] = [];
  if (myId && conversation.assigned_to !== myId) {
    assignItems.push({
      key: "me",
      label: t("conversations.assignToMe"),
      icon: <UserRound className="size-4" aria-hidden="true" />,
      onSelect: () => change({ assigned_to: myId }, "conversations.toastAssigned"),
    });
  }
  for (const member of members ?? []) {
    if (member.user_id === myId) continue;
    assignItems.push({
      key: member.user_id,
      label: memberName(member),
      checked: conversation.assigned_to === member.user_id,
      onSelect: () => {
        if (conversation.assigned_to !== member.user_id) {
          change({ assigned_to: member.user_id }, "conversations.toastAssigned");
        }
      },
    });
  }
  if (membersError && onRetryMembers) {
    // Say why the list has no colleagues, instead of silently offering only "Assign to me".
    assignItems.push({
      key: "retry-members",
      label: t("conversations.assignMembersRetry"),
      icon: <RotateCcw className="size-4" aria-hidden="true" />,
      onSelect: onRetryMembers,
    });
  }
  if (conversation.assigned_to) {
    assignItems.push({
      key: "none",
      label: t("conversations.unassign"),
      icon: <UserRoundX className="size-4" aria-hidden="true" />,
      onSelect: () => change({ assigned_to: null }, "conversations.toastUnassigned"),
    });
  }

  async function confirmRemove() {
    setDeleteError(null);
    try {
      await remove.mutateAsync();
      setConfirmDelete(false);
      toast.success(t("conversations.toastDeleted"));
      void navigate({ pathname: "/app/conversations", search: listSearch }, { replace: true });
    } catch (error) {
      setDeleteError(errorText(t, error));
    }
  }

  const busy = update.isPending;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {conversation.ai_paused ? (
          // After STOP the assistant never answers again; the opted-out notice explains why.
          !conversation.opted_out_at && (
            <Button
              variant="secondary"
              size="sm"
              disabled={busy}
              icon={<Bot className="size-4" aria-hidden="true" />}
              onClick={resumeAssistant}
            >
              {t("conversations.resumeAssistant")}
            </Button>
          )
        ) : (
          <Button
            variant="primary"
            size="sm"
            disabled={busy}
            icon={<Hand className="size-4" aria-hidden="true" />}
            onClick={() => change({ ai_paused: true }, "conversations.toastPaused")}
          >
            {t("conversations.takeOver")}
          </Button>
        )}

        {conversation.status === "closed" ? (
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            icon={<RotateCcw className="size-4" aria-hidden="true" />}
            onClick={() => change({ status: "open" }, "conversations.toastReopened")}
          >
            {t("conversations.reopen")}
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            icon={<CheckCircle2 className="size-4" aria-hidden="true" />}
            onClick={() => change({ status: "closed" }, "conversations.toastClosed")}
          >
            {t("conversations.close")}
          </Button>
        )}

        <Menu
          align="start"
          items={assignItems}
          header={
            <p className="text-xs text-slate-500">
              {t("conversations.assignedNow", { name: assigneeLabel })}
            </p>
          }
          trigger={(props) => (
            <button
              type="button"
              {...props}
              disabled={busy || assignItems.length === 0}
              className={buttonClasses({ variant: "outline", size: "sm" })}
            >
              <UserRound className="size-4" aria-hidden="true" />
              <span className="max-w-40 truncate">
                {assigneeUnknown
                  ? t("conversations.assignedUnknown")
                  : t("conversations.assignButton", { name: assigneeLabel })}
              </span>
              <ChevronDown className="size-4" aria-hidden="true" />
            </button>
          )}
        />

        {manager && (
          <Button
            variant="ghost"
            size="sm"
            className="text-red-700 hover:bg-red-50"
            icon={<Trash2 className="size-4" aria-hidden="true" />}
            onClick={() => {
              setDeleteError(null);
              setConfirmDelete(true);
            }}
          >
            {t("conversations.delete")}
          </Button>
        )}
      </div>
      {!manager && (
        <p className="text-xs text-slate-500">{t("conversations.deleteManagersOnly")}</p>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={confirmRemove}
        title={t("conversations.deleteTitle")}
        description={t("conversations.deleteText")}
        confirmLabel={t("conversations.deleteConfirm")}
        error={deleteError}
      />
    </div>
  );
}
