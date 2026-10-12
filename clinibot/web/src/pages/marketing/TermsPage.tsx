import { PublicLayout } from "@/components/layout/PublicLayout";
import { PageHeader } from "@/components/ui";
import { useI18n } from "@/i18n";
import { useDocumentTitle } from "@/lib/useDocumentTitle";

/** Placeholder: replace this file with the full terms of service. */
export default function TermsPage() {
  const { t } = useI18n();
  useDocumentTitle(t("legal.termsTitle"));
  return (
    <PublicLayout>
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <PageHeader title={t("legal.termsTitle")} description={t("legal.termsIntro")} />
      </div>
    </PublicLayout>
  );
}
