import { useSearchParams } from "react-router";
import { Alert, PageHeader, TabList, TabPanel, Tabs } from "@/components/ui";
import { FaqsSection } from "@/components/knowledge/FaqsSection";
import { KnowledgePreview } from "@/components/knowledge/KnowledgePreview";
import { useFaqs, useServices } from "@/components/knowledge/queries";
import { ServicesSection } from "@/components/knowledge/ServicesSection";
import { useI18n } from "@/i18n";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import { canManage } from "@/org/roles";
import { useCurrentOrg } from "@/org/useOrg";

type Tab = "services" | "faqs";

/** /app/knowledge — the services, prices and FAQs the assistant answers from. */
export default function KnowledgePage() {
  const { t, formatNumber } = useI18n();
  const org = useCurrentOrg();
  const canEdit = canManage(org.role);
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get("tab") === "faqs" ? "faqs" : "services";
  const services = useServices(org.id);
  const faqs = useFaqs(org.id);
  useDocumentTitle(t("knowledge.title"));

  function selectTab(value: string) {
    setParams(value === "faqs" ? { tab: "faqs" } : {}, { replace: true });
  }

  return (
    <>
      <PageHeader title={t("knowledge.title")} description={t("knowledge.description")} />

      {!canEdit && (
        <Alert tone="info" title={t("knowledge.readOnlyTitle")} className="mb-5">
          {t("knowledge.readOnlyText")}
        </Alert>
      )}

      <Tabs value={tab} onValueChange={selectTab}>
        <TabList
          label={t("knowledge.tabsLabel")}
          items={[
            {
              value: "services",
              label: t("knowledge.tabServices"),
              ...(services.data ? { badge: formatNumber(services.data.length) } : {}),
            },
            {
              value: "faqs",
              label: t("knowledge.tabFaqs"),
              ...(faqs.data ? { badge: formatNumber(faqs.data.length) } : {}),
            },
          ]}
        />
        <TabPanel value="services">
          <ServicesSection orgId={org.id} canEdit={canEdit} />
        </TabPanel>
        <TabPanel value="faqs">
          <FaqsSection orgId={org.id} canEdit={canEdit} />
        </TabPanel>
      </Tabs>

      <KnowledgePreview orgId={org.id} />
    </>
  );
}
