import { PublicLayout } from "@/components/layout/PublicLayout";
import { PageHeader } from "@/components/ui";
import { useI18n } from "@/i18n";
import { useDocumentTitle } from "@/lib/useDocumentTitle";

/** Placeholder: replace this file with the full privacy policy. */
export default function PrivacyPage() {
  const { t } = useI18n();
  useDocumentTitle(t("legal.privacyTitle"));
  return (
    <PublicLayout>
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <PageHeader title={t("legal.privacyTitle")} description={t("legal.privacyIntro")} />
      </div>
    </PublicLayout>
  );
}
