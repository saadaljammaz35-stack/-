import { Navigate, Route, Routes } from "react-router";
import { QueryError } from "@/components/layout/QueryError";
import { ChatLinkCard } from "@/components/settings/ChatLinkCard";
import { DangerZone } from "@/components/settings/DangerZone";
import { DetailsSection } from "@/components/settings/DetailsSection";
import { HoursSection } from "@/components/settings/HoursSection";
import { PrivacySection } from "@/components/settings/PrivacySection";
import { ProfileSection } from "@/components/settings/ProfileSection";
import { useClinicSettings, useOrganizationProfile } from "@/components/settings/queries";
import { Alert, Card, CardBody, PageHeader, SkeletonText } from "@/components/ui";
import { useI18n } from "@/i18n";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import { canManage } from "@/org/roles";
import { useCurrentOrg } from "@/org/useOrg";

/** /app/settings: clinic profile, chat link, details, hours, privacy and the danger zone. */
export default function SettingsPage() {
  return (
    <Routes>
      <Route index element={<ClinicSettingsPage />} />
      <Route path="*" element={<Navigate to="/app/settings" replace />} />
    </Routes>
  );
}

function SectionSkeleton() {
  return (
    <Card aria-hidden="true">
      <CardBody>
        <SkeletonText lines={4} />
      </CardBody>
    </Card>
  );
}

function ClinicSettingsPage() {
  const { t } = useI18n();
  const org = useCurrentOrg();
  useDocumentTitle(t("settings.title"));
  const readOnly = !canManage(org.role);

  const profile = useOrganizationProfile(org.id);
  const settings = useClinicSettings(org.id);

  return (
    <>
      <PageHeader title={t("settings.title")} description={t("settings.description")} />
      <div className="flex flex-col gap-6">
        {readOnly && <Alert tone="info">{t("settings.readOnlyNotice")}</Alert>}

        {profile.error ? (
          <QueryError error={profile.error} onRetry={() => void profile.refetch()} />
        ) : profile.isPending ? (
          <SectionSkeleton />
        ) : (
          <ProfileSection key={org.id} profile={profile.data} readOnly={readOnly} />
        )}

        <ChatLinkCard
          slug={org.slug}
          publicChatEnabled={settings.data ? settings.data.public_chat_enabled : null}
        />

        {settings.error ? (
          <QueryError error={settings.error} onRetry={() => void settings.refetch()} />
        ) : settings.isPending ? (
          <>
            <SectionSkeleton />
            <SectionSkeleton />
            <SectionSkeleton />
          </>
        ) : settings.data === null ? (
          <Alert tone="warning">{t("settings.missingSettings")}</Alert>
        ) : (
          <>
            <DetailsSection
              key={`details-${org.id}`}
              orgId={org.id}
              settings={settings.data}
              readOnly={readOnly}
            />
            <HoursSection
              key={`hours-${org.id}`}
              orgId={org.id}
              settings={settings.data}
              readOnly={readOnly}
            />
            <PrivacySection
              key={`privacy-${org.id}`}
              orgId={org.id}
              orgName={org.name}
              settings={settings.data}
              readOnly={readOnly}
            />
          </>
        )}

        <DangerZone org={org} />
      </div>
    </>
  );
}
