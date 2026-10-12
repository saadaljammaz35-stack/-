import { StubPage } from "@/components/layout/StubPage";
import { useI18n } from "@/i18n";

/** Placeholder: replace this file with the real page (keep the default export). */
export default function AppointmentsPage() {
  const { t } = useI18n();
  return <StubPage title={t("appointments.title")} description={t("appointments.description")} />;
}
