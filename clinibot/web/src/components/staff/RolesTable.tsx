import { Check, Minus } from "lucide-react";
import { Card, CardHeader } from "@/components/ui";
import { useI18n, type MessageKey } from "@/i18n";
import { ROLE_LABELS } from "@/org/roles";
import { CAPABILITIES, ROLE_ORDER, type CapabilityKey } from "./permissions";

const CAPABILITY_LABELS: Record<CapabilityKey, MessageKey> = {
  conversations: "staff.cap_conversations",
  knowledgeView: "staff.cap_knowledgeView",
  knowledgeEdit: "staff.cap_knowledgeEdit",
  assistant: "staff.cap_assistant",
  settings: "staff.cap_settings",
  staffReceptionists: "staff.cap_staffReceptionists",
  audit: "staff.cap_audit",
  billing: "staff.cap_billing",
  staffRoles: "staff.cap_staffRoles",
  deleteClinic: "staff.cap_deleteClinic",
};

/** What each role can do, as a capability × role table (fits a 375px screen). */
export function RolesTable() {
  const { t } = useI18n();
  return (
    <Card as="section" aria-labelledby="roles-table-title">
      <CardHeader
        title={<span id="roles-table-title">{t("staff.rolesTitle")}</span>}
        description={t("staff.rolesDescription")}
      />
      <div className="px-2 pb-2 sm:px-4">
        <table className="w-full table-fixed border-collapse text-sm">
          <caption className="sr-only">{t("staff.rolesCaption")}</caption>
          <colgroup>
            <col />
            {ROLE_ORDER.map((role) => (
              <col key={role} className="w-[4.25rem] sm:w-28" />
            ))}
          </colgroup>
          <thead>
            <tr className="border-b border-slate-200">
              <th
                scope="col"
                className="px-2 py-3 text-start text-xs font-bold text-slate-500 sm:px-3"
              >
                {t("staff.capability")}
              </th>
              {ROLE_ORDER.map((role) => (
                <th
                  key={role}
                  scope="col"
                  className="px-1 py-3 text-center text-xs leading-tight font-bold text-slate-700"
                >
                  {t(ROLE_LABELS[role])}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CAPABILITIES.map((capability) => (
              <tr key={capability.key} className="border-b border-slate-100 last:border-0">
                <th
                  scope="row"
                  className="px-2 py-2.5 text-start leading-snug font-medium text-slate-800 sm:px-3"
                >
                  {t(CAPABILITY_LABELS[capability.key])}
                </th>
                {ROLE_ORDER.map((role) => {
                  const allowed = (capability.roles as readonly string[]).includes(role);
                  return (
                    <td key={role} className="px-1 py-2.5 text-center">
                      {allowed ? (
                        <Check className="mx-auto size-5 text-accent-strong" aria-hidden="true" />
                      ) : (
                        <Minus className="mx-auto size-4 text-slate-300" aria-hidden="true" />
                      )}
                      <span className="sr-only">
                        {allowed ? t("staff.allowed") : t("staff.notAllowed")}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
