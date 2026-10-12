import { FileQuestionMark } from "lucide-react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { ButtonLink, EmptyState } from "@/components/ui";
import { useI18n } from "@/i18n";
import { useDocumentTitle } from "@/lib/useDocumentTitle";

/** 404 inside the dashboard (keeps the app shell). */
export function NotFoundContent() {
  const { t } = useI18n();
  useDocumentTitle(t("common.notFoundTitle"));
  return (
    <EmptyState
      icon={FileQuestionMark}
      title={t("common.notFoundTitle")}
      text={t("common.notFoundText")}
      action={<ButtonLink to="/app">{t("common.goToDashboard")}</ButtonLink>}
      className="py-20"
    />
  );
}

/** 404 for public URLs. */
export default function NotFoundPage() {
  const { t } = useI18n();
  useDocumentTitle(t("common.notFoundTitle"));
  return (
    <PublicLayout>
      <EmptyState
        icon={FileQuestionMark}
        title={t("common.notFoundTitle")}
        text={t("common.notFoundText")}
        action={<ButtonLink to="/">{t("common.goHome")}</ButtonLink>}
        className="py-24"
      />
    </PublicLayout>
  );
}
