import { Fragment, type ReactNode } from "react";
import { hasMessage, useI18n } from "@/i18n";
import type { MemberRole } from "@/org/context";
import { ROLE_LABELS } from "@/org/roles";
import { auditColumnLabel, type AuditDetail } from "./actions";

function isRole(value: string): value is MemberRole {
  return value === "owner" || value === "admin" || value === "receptionist";
}

/** A translated value when one exists (status, outcome, plan, channel); otherwise the raw value. */
function useValueLabel() {
  const { t } = useI18n();
  return (prefix: "status" | "outcome" | "plan" | "channel", value: string): ReactNode => {
    const key = `audit.${prefix}_${value}`;
    if (hasMessage(key)) return t(key);
    return (
      <code dir="ltr" className="font-mono text-xs">
        {value}
      </code>
    );
  };
}

function Arrow() {
  const { dir } = useI18n();
  return <span aria-hidden="true">{dir === "rtl" ? " ← " : " → "}</span>;
}

/** The facts of one audit entry, one per line. */
export function AuditDetails({
  details,
  names,
}: {
  details: AuditDetail[];
  /** Current team names by user id; null while the team list is unavailable. */
  names: ReadonlyMap<string, string> | null;
}) {
  const { t, formatNumber } = useI18n();
  const valueLabel = useValueLabel();
  const roleLabel = (role: string): ReactNode =>
    isRole(role) ? t(ROLE_LABELS[role]) : valueLabel("status", role);

  if (details.length === 0) return <span className="text-slate-400">{t("audit.noDetails")}</span>;

  const rows: { label: string; value: ReactNode }[] = [];
  for (const detail of details) {
    switch (detail.kind) {
      case "changed":
        rows.push({
          label: t("audit.detailChanged"),
          value: detail.columns.map((column, index) => {
            const key = auditColumnLabel(column);
            return (
              <Fragment key={column}>
                {index > 0 && t("audit.listSeparator")}
                {key ? (
                  t(key)
                ) : (
                  <code dir="ltr" className="font-mono text-xs break-all">
                    {column}
                  </code>
                )}
              </Fragment>
            );
          }),
        });
        break;
      case "status":
        rows.push({
          label: t("audit.detailStatus"),
          value: (
            <>
              {detail.from && (
                <>
                  {valueLabel("status", detail.from)}
                  <Arrow />
                </>
              )}
              {valueLabel("status", detail.to)}
            </>
          ),
        });
        break;
      case "role":
        rows.push({
          label: t("audit.detailRole"),
          value: (
            <>
              {detail.from && (
                <>
                  {roleLabel(detail.from)}
                  <Arrow />
                </>
              )}
              {roleLabel(detail.to)}
            </>
          ),
        });
        break;
      case "invitedRole":
        rows.push({ label: t("audit.detailInvitedAs"), value: roleLabel(detail.role) });
        if (detail.newAccount !== null) {
          rows.push({
            label: "",
            value: detail.newAccount
              ? t("audit.detailNewAccount")
              : t("audit.detailExistingAccount"),
          });
        }
        break;
      case "member":
        rows.push({
          label: t("audit.detailMember"),
          value:
            names === null
              ? t("audit.actorUnknown")
              : (names.get(detail.userId) ?? t("audit.actorFormer")),
        });
        break;
      case "aiPaused":
        rows.push({
          label: t("audit.detailAssistant"),
          value: detail.value ? t("audit.aiPausedOn") : t("audit.aiPausedOff"),
        });
        break;
      case "plan":
        rows.push({ label: t("audit.detailPlan"), value: valueLabel("plan", detail.value) });
        break;
      case "channel":
        rows.push({ label: t("audit.detailChannel"), value: valueLabel("channel", detail.value) });
        break;
      case "outcome":
        rows.push({ label: t("audit.detailOutcome"), value: valueLabel("outcome", detail.value) });
        break;
      case "template":
        rows.push({ label: "", value: t("audit.detailTemplate") });
        break;
      case "messagesDeleted":
        rows.push({
          label: t("audit.detailMessagesDeleted"),
          value: formatNumber(detail.count),
        });
        break;
    }
  }

  return (
    <ul className="flex flex-col gap-0.5 text-[0.8125rem] leading-relaxed">
      {rows.map((row, index) => (
        <li key={index} className="min-w-0 text-slate-800">
          {row.label && <span className="text-slate-500">{row.label}: </span>}
          {row.value}
        </li>
      ))}
    </ul>
  );
}
