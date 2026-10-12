import { StubPage } from "@/components/layout/StubPage";
import { useI18n } from "@/i18n";

/** Placeholder: replace this file with the real page (keep the default export). */
export default function WhatsAppPage() {
  const { t } = useI18n();
  return <StubPage title={t("whatsapp.title")} description={t("whatsapp.description")} />;
}
