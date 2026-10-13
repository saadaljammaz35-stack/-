import { FileQuestionMark } from "lucide-react";
import { ButtonLink, EmptyState } from "@/components/ui";
import { useI18n } from "@/i18n";
import { useDocumentTitle } from "@/lib/useDocumentTitle";

/** Unknown sub-path inside a section (e.g. /app/conversations/x/y): stays in the app shell. */
export function SectionNotFound({ backTo }: { backTo: string }) {
  const { t } = useI18n();
  useDocumentTitle(t("common.notFoundTitle"));
  return (
    <EmptyState
      icon={FileQuestionMark}
      title={t("common.notFoundTitle")}
      text={t("common.notFoundText")}
      action={<ButtonLink to={backTo}>{t("common.back")}</ButtonLink>}
      className="py-20"
    />
  );
}
