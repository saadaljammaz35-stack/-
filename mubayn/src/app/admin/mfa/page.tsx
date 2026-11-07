import { notFound } from "next/navigation";
import { MfaEnrol } from "@/components/admin-client";
import { currentSession } from "@/lib/auth";

export const metadata = { title: "Admin verification", robots: { index: false } };

export default async function AdminMfa() {
  const s = await currentSession();
  if (!s || s.user.role !== "admin") notFound();
  return (
    <div className="auth-shell" dir="ltr" lang="en">
      <div className="card auth-card">
        <h1 style={{ fontSize: "1.5rem" }}>Two-factor verification</h1>
        <p className="muted">The admin area requires an authenticator code on every sign-in.</p>
        <MfaEnrol enrolled={Boolean(s.user.mfa_enabled_at)} />
      </div>
    </div>
  );
}
