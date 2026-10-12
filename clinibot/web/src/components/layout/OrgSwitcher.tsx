import { Building, ChevronsUpDown, Plus } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router";
import { Menu } from "@/components/ui";
import { useI18n } from "@/i18n";
import { ROLE_LABELS } from "@/org/roles";
import { useOrg } from "@/org/useOrg";

/** Shows the current clinic; lets members of several clinics switch. */
export function OrgSwitcher({ onSwitched }: { onSwitched?: () => void }) {
  const { t } = useI18n();
  const { orgs, current, setCurrentOrg } = useOrg();
  const navigate = useNavigate();
  const location = useLocation();
  if (!current) return null;

  function switchTo(orgId: string) {
    if (orgId === current?.id) return;
    setCurrentOrg(orgId);
    // Detail pages (e.g. /app/conversations/<id>) belong to the old clinic: go to the section root.
    const section = location.pathname.split("/")[2];
    void navigate(section ? `/app/${section}` : "/app");
    onSwitched?.();
  }

  return (
    <Menu
      align="start"
      className="w-full"
      trigger={(props) => (
        <button
          type="button"
          {...props}
          className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-start hover:bg-slate-50"
          aria-label={`${t("common.switchClinic")}: ${current.name}`}
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-mint text-accent-strong">
            <Building className="size-5" aria-hidden="true" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-bold text-slate-900">{current.name}</span>
            <span className="truncate text-xs text-slate-500">{t(ROLE_LABELS[current.role])}</span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
        </button>
      )}
      header={<p className="text-xs font-bold text-slate-500">{t("common.switchClinic")}</p>}
      items={orgs.map((org) => ({
        key: org.id,
        label: org.name,
        checked: org.id === current.id,
        onSelect: () => switchTo(org.id),
      }))}
      footer={
        <Link
          to="/onboarding"
          onClick={onSwitched}
          className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-primary hover:bg-primary-soft"
        >
          <Plus className="size-5" aria-hidden="true" />
          {t("common.addClinic")}
        </Link>
      }
    />
  );
}
