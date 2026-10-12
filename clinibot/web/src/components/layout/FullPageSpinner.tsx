import { useI18n } from "@/i18n";
import { Spinner } from "@/components/ui/Spinner";

/** Centered spinner for route-level loading (auth check, lazy pages). */
export function FullPageSpinner({ inline = false }: { inline?: boolean }) {
  const { t } = useI18n();
  return (
    <div className={inline ? "flex justify-center py-20" : "flex min-h-dvh items-center justify-center"}>
      <Spinner size="lg" className="text-primary" label={t("common.loading")} />
    </div>
  );
}
