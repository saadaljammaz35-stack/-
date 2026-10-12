import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router";
import { GuestOnlyRoute, ProtectedRoute } from "@/auth/ProtectedRoute";
import { FullPageSpinner } from "@/components/layout/FullPageSpinner";
import { RequireOrg, RequireRole } from "@/org/RequireOrg";
import { MANAGER_ROLES } from "@/org/roles";

// Every page is its own chunk so the marketing page and the patient chat stay
// small. To add a page: create the file, add a lazy() line and a <Route>.

// Public
const HomePage = lazy(() => import("@/pages/marketing/HomePage"));
const PrivacyPage = lazy(() => import("@/pages/marketing/PrivacyPage"));
const TermsPage = lazy(() => import("@/pages/marketing/TermsPage"));
const PatientChatPage = lazy(() => import("@/pages/chat/PatientChatPage"));
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage"));
const NotFoundContent = lazy(() =>
  import("@/pages/NotFoundPage").then((module) => ({ default: module.NotFoundContent })),
);

// Auth
const LoginPage = lazy(() => import("@/pages/auth/LoginPage"));
const RegisterPage = lazy(() => import("@/pages/auth/RegisterPage"));
const ForgotPasswordPage = lazy(() => import("@/pages/auth/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("@/pages/auth/ResetPasswordPage"));
const AuthCallbackPage = lazy(() => import("@/pages/auth/AuthCallbackPage"));
const AcceptInvitePage = lazy(() => import("@/pages/auth/AcceptInvitePage"));
const OnboardingPage = lazy(() => import("@/pages/onboarding/OnboardingPage"));

// Dashboard (/app/*)
const AppShell = lazy(() =>
  import("@/components/layout/AppShell").then((module) => ({ default: module.AppShell })),
);
const OverviewPage = lazy(() => import("@/pages/app/OverviewPage"));
const ConversationsPage = lazy(() => import("@/pages/app/ConversationsPage"));
const AppointmentsPage = lazy(() => import("@/pages/app/AppointmentsPage"));
const KnowledgePage = lazy(() => import("@/pages/app/KnowledgePage"));
const AssistantPage = lazy(() => import("@/pages/app/AssistantPage"));
const WhatsAppPage = lazy(() => import("@/pages/app/WhatsAppPage"));
const StaffPage = lazy(() => import("@/pages/app/StaffPage"));
const BillingPage = lazy(() => import("@/pages/app/BillingPage"));
const SettingsPage = lazy(() => import("@/pages/app/SettingsPage"));
const AuditPage = lazy(() => import("@/pages/app/AuditPage"));

/**
 * Route table. Sections under /app end in "/*" so each page can declare its
 * own nested routes with a relative <Routes>, e.g. in ConversationsPage:
 *   <Routes><Route index element={<List />} /><Route path=":id" element={<Thread />} /></Routes>
 */
export function AppRoutes() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/c/:slug" element={<PatientChatPage />} />

        <Route element={<GuestOnlyRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        </Route>
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/auth/accept-invite" element={<AcceptInvitePage />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route element={<RequireOrg />}>
            <Route path="/app" element={<AppShell />}>
              <Route index element={<OverviewPage />} />
              <Route path="conversations/*" element={<ConversationsPage />} />
              <Route path="appointments/*" element={<AppointmentsPage />} />
              <Route path="knowledge/*" element={<KnowledgePage />} />
              <Route path="assistant/*" element={<AssistantPage />} />
              <Route path="whatsapp/*" element={<WhatsAppPage />} />
              <Route path="staff/*" element={<StaffPage />} />
              <Route path="billing/*" element={<BillingPage />} />
              <Route path="settings/*" element={<SettingsPage />} />
              <Route
                path="audit/*"
                element={
                  <RequireRole roles={MANAGER_ROLES}>
                    <AuditPage />
                  </RequireRole>
                }
              />
              <Route path="*" element={<NotFoundContent />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
