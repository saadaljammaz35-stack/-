import { Outlet } from "react-router";
import { OrgProvider } from "@/org/OrgProvider";
import { AuthProvider } from "./AuthProvider";

/**
 * Layout route for everything that needs a session (auth pages, onboarding,
 * /app). Lazy-loaded from routes.tsx so the Supabase client stays out of the
 * public pages' bundle.
 */
export default function AuthRoot() {
  return (
    <AuthProvider>
      <OrgProvider>
        <Outlet />
      </OrgProvider>
    </AuthProvider>
  );
}
