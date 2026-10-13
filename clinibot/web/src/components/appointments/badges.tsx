import { Badge } from "@/components/ui";
import { useI18n } from "@/i18n";
import { sourceLabel, STATUS_LABELS, STATUS_TONES, type AppointmentStatus } from "./model";

/** The request's status exactly as stored; "confirmed" only when it is confirmed. */
export function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  const { t } = useI18n();
  return (
    <Badge tone={STATUS_TONES[status]} dot>
      {t(STATUS_LABELS[status])}
    </Badge>
  );
}

export function SourceBadge({ source }: { source: string }) {
  const { t } = useI18n();
  return <Badge tone="neutral">{t(sourceLabel(source))}</Badge>;
}
