import { RotateCcw } from "lucide-react";
import { Alert, Button } from "@/components/ui";
import { useI18n } from "@/i18n";

/**
 * One notice for a list whose team names failed to load (the rows then say
 * "Assigned" or "Name unavailable", never "Former member").
 */
export function MembersError({
  onRetry,
  retrying = false,
  className,
}: {
  onRetry: () => void;
  retrying?: boolean;
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <Alert
      tone="warning"
      className={className}
      action={
        <Button
          size="sm"
          variant="outline"
          onClick={onRetry}
          loading={retrying}
          icon={<RotateCcw className="size-4" aria-hidden="true" />}
        >
          {t("common.retry")}
        </Button>
      }
    >
      {t("dashboard.membersError")}
    </Alert>
  );
}
