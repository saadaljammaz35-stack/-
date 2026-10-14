import { Badge } from "@/components/ui";
import { useI18n } from "@/i18n";
import type { MemberRole } from "@/org/context";
import { ROLE_LABELS } from "@/org/roles";
import { ROLE_TONES } from "./roleText";

export function RoleBadge({ role }: { role: MemberRole }) {
  const { t } = useI18n();
  return <Badge tone={ROLE_TONES[role]}>{t(ROLE_LABELS[role])}</Badge>;
}
