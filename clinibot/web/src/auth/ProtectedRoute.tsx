import type { ReactNode } from "react";
import { Navigate, Outlet, useLocation, useSearchParams } from "react-router";
import { FullPageSpinner } from "@/components/layout/FullPageSpinner";
import { safeNextPath } from "@/lib/validation";
import { useAuth } from "./useAuth";

/**
 * Renders its children (or nested routes) only for signed-in users; everyone
 * else goes to /login?next=<where they wanted to go>.
 */
export function ProtectedRoute({ children }: { children?: ReactNode }) {
  const { session, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullPageSpinner />;
  if (!session) {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }
  return children ?? <Outlet />;
}

/** For /login, /register, /forgot-password: signed-in users continue to ?next= or /app. */
export function GuestOnlyRoute({ children }: { children?: ReactNode }) {
  const { session, loading } = useAuth();
  const [params] = useSearchParams();
  if (loading) return <FullPageSpinner />;
  if (session) return <Navigate to={safeNextPath(params.get("next"))} replace />;
  return children ?? <Outlet />;
}
