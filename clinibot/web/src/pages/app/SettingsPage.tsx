import { StubPage } from "@/components/layout/StubPage";
import { useI18n } from "@/i18n";

/** Placeholder: replace this file with the real page (keep the default export). */
export default function SettingsPage() {
  const { t } = useI18n();
  return <StubPage title={t("settings.title")} description={t("settings.description")} />;
}
