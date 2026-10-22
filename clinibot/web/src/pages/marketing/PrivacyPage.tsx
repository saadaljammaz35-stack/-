import { LegalDocument, type LegalSection } from "@/components/marketing/LegalDocument";
import { useI18n } from "@/i18n";
import { useDocumentTitle } from "@/lib/useDocumentTitle";

const PRIVACY_UPDATED = "2026-10-20";

const SECTIONS: readonly LegalSection[] = [
  {
    id: "who-we-are",
    title: "legal.p_who_title",
    blocks: [
      { kind: "p", key: "legal.p_who_1" },
      { kind: "p", key: "legal.p_who_2" },
    ],
  },
  {
    id: "roles",
    title: "legal.p_roles_title",
    blocks: [
      { kind: "p", key: "legal.p_roles_1" },
      { kind: "p", key: "legal.p_roles_2" },
    ],
  },
  {
    id: "data-we-collect",
    title: "legal.p_data_title",
    blocks: [
      {
        kind: "list",
        intro: "legal.p_data_intro",
        keys: [
          "legal.p_data_staff",
          "legal.p_data_messages",
          "legal.p_data_appointments",
          "legal.p_data_whatsapp",
          "legal.p_data_logs",
          "legal.p_data_demo",
        ],
      },
      { kind: "p", key: "legal.p_data_sensitive" },
    ],
  },
  {
    id: "purposes",
    title: "legal.p_purpose_title",
    blocks: [
      {
        kind: "list",
        intro: "legal.p_purpose_intro",
        keys: [
          "legal.p_purpose_1",
          "legal.p_purpose_2",
          "legal.p_purpose_3",
          "legal.p_purpose_4",
          "legal.p_purpose_5",
          "legal.p_purpose_6",
        ],
      },
      { kind: "p", key: "legal.p_purpose_none" },
    ],
  },
  {
    id: "storage-and-processors",
    title: "legal.p_where_title",
    blocks: [
      {
        kind: "list",
        intro: "legal.p_where_intro",
        keys: [
          "legal.p_where_db",
          "legal.p_where_ai",
          "legal.p_where_whatsapp",
          "legal.p_where_email",
          "legal.p_where_hosting",
        ],
      },
      { kind: "p", key: "legal.p_where_transfer" },
    ],
  },
  {
    id: "retention",
    title: "legal.p_retention_title",
    blocks: [
      {
        kind: "list",
        intro: "legal.p_retention_intro",
        keys: [
          "legal.p_retention_messages",
          "legal.p_retention_appointments",
          "legal.p_retention_audit",
          "legal.p_retention_demo",
        ],
      },
      { kind: "p", key: "legal.p_retention_purge" },
    ],
  },
  {
    id: "your-rights",
    title: "legal.p_rights_title",
    blocks: [
      {
        kind: "list",
        intro: "legal.p_rights_intro",
        keys: ["legal.p_rights_webchat", "legal.p_rights_whatsapp", "legal.p_rights_appointments"],
      },
      { kind: "p", key: "legal.p_rights_clinic" },
      { kind: "p", key: "legal.p_rights_staff" },
    ],
  },
  {
    id: "security",
    title: "legal.p_security_title",
    blocks: [
      {
        kind: "list",
        intro: "legal.p_security_intro",
        keys: [
          "legal.p_security_1",
          "legal.p_security_2",
          "legal.p_security_3",
          "legal.p_security_4",
          "legal.p_security_5",
          "legal.p_security_6",
        ],
      },
      { kind: "p", key: "legal.p_security_incident" },
    ],
  },
  {
    id: "not-medical",
    title: "legal.p_medical_title",
    blocks: [{ kind: "p", key: "legal.p_medical_1" }],
  },
  {
    id: "changes",
    title: "legal.p_changes_title",
    blocks: [{ kind: "p", key: "legal.p_changes_1" }],
  },
  {
    id: "contact",
    title: "legal.p_contact_title",
    blocks: [
      { kind: "contact", emailKey: "legal.p_contact_email", formKey: "legal.p_contact_form" },
      { kind: "p", key: "legal.p_contact_clinic" },
    ],
  },
];

export default function PrivacyPage() {
  const { t } = useI18n();
  useDocumentTitle(t("legal.privacyTitle"));
  return (
    <LegalDocument
      title="legal.privacyTitle"
      intro="legal.privacyIntro"
      updated={PRIVACY_UPDATED}
      sections={SECTIONS}
      related={{ to: "/terms", label: "legal.termsTitle", sentence: "legal.seeAlsoTerms" }}
    />
  );
}
