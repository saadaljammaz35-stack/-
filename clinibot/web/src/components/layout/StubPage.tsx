import { Construction } from "lucide-react";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { useI18n } from "@/i18n";
import { useDocumentTitle } from "@/lib/useDocumentTitle";

/** Placeholder for sections not built yet. Replace the page file, not this component. */
export function StubPage({ title, description }: { title: string; description: string }) {
  const { t } = useI18n();
  useDocumentTitle(title);
  return (
    <>
      <PageHeader title={title} description={description} />
      <Card>
        <EmptyState
          icon={Construction}
          title={t("common.comingSoon")}
          text={t("common.stubNotice")}
        />
      </Card>
    </>
  );
}
