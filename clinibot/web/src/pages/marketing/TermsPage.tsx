import { LegalDocument, type LegalSection } from "@/components/marketing/LegalDocument";
import { useI18n } from "@/i18n";
import { useDocumentTitle } from "@/lib/useDocumentTitle";

const TERMS_UPDATED = "2026-10-12";

const SECTIONS: readonly LegalSection[] = [
  {
    id: "service",
    title: "legal.t_service_title",
    blocks: [
      { kind: "p", key: "legal.t_service_1" },
      { kind: "p", key: "legal.t_service_2" },
    ],
  },
  {
    id: "accounts",
    title: "legal.t_accounts_title",
    blocks: [
      { kind: "p", key: "legal.t_accounts_1" },
      { kind: "p", key: "legal.t_accounts_2" },
      { kind: "p", key: "legal.t_accounts_3" },
    ],
  },
  {
    id: "clinic-responsibilities",
    title: "legal.t_clinic_title",
    blocks: [
      {
        kind: "list",
        intro: "legal.t_clinic_intro",
        keys: [
          "legal.t_clinic_1",
          "legal.t_clinic_2",
          "legal.t_clinic_3",
          "legal.t_clinic_4",
          "legal.t_clinic_5",
        ],
      },
    ],
  },
  {
    id: "ai-limits",
    title: "legal.t_ai_title",
    blocks: [
      { kind: "p", key: "legal.t_ai_1" },
      { kind: "p", key: "legal.t_ai_2" },
      { kind: "p", key: "legal.t_ai_3" },
    ],
  },
  {
    id: "appointments",
    title: "legal.t_appointments_title",
    blocks: [{ kind: "p", key: "legal.t_appointments_1" }],
  },
  {
    id: "trial-and-fees",
    title: "legal.t_fees_title",
    blocks: [
      {
        kind: "list",
        keys: [
          "legal.t_fees_1",
          "legal.t_fees_2",
          "legal.t_fees_3",
          "legal.t_fees_4",
          "legal.t_fees_5",
        ],
      },
    ],
  },
  {
    id: "data-processing",
    title: "legal.t_data_title",
    blocks: [{ kind: "privacyRef", key: "legal.t_data_1" }],
  },
  {
    id: "availability",
    title: "legal.t_availability_title",
    blocks: [{ kind: "p", key: "legal.t_availability_1" }],
  },
  {
    id: "liability",
    title: "legal.t_liability_title",
    blocks: [{ kind: "p", key: "legal.t_liability_1" }],
  },
  {
    id: "termination",
    title: "legal.t_termination_title",
    blocks: [
      { kind: "p", key: "legal.t_termination_1" },
      { kind: "p", key: "legal.t_termination_2" },
      { kind: "p", key: "legal.t_termination_3" },
    ],
  },
  {
    id: "governing-law",
    title: "legal.t_law_title",
    blocks: [{ kind: "p", key: "legal.t_law_1" }],
  },
  {
    id: "changes",
    title: "legal.t_changes_title",
    blocks: [{ kind: "p", key: "legal.t_changes_1" }],
  },
  {
    id: "contact",
    title: "legal.t_contact_title",
    blocks: [
      { kind: "contact", emailKey: "legal.t_contact_email", formKey: "legal.t_contact_form" },
    ],
  },
];

export default function TermsPage() {
  const { t } = useI18n();
  useDocumentTitle(t("legal.termsTitle"));
  return (
    <LegalDocument
      title="legal.termsTitle"
      intro="legal.termsIntro"
      updated={TERMS_UPDATED}
      sections={SECTIONS}
      related={{ to: "/privacy", label: "legal.privacyTitle", sentence: "legal.seeAlsoPrivacy" }}
    />
  );
}
