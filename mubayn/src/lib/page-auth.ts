import { notFound, redirect } from "next/navigation";
import { currentSession, type Session } from "./auth";

/** For server-rendered pages: redirect to sign-in instead of throwing. */
export async function pageUser(next: string): Promise<Session> {
  const s = await currentSession();
  if (!s) redirect(`/login?next=${encodeURIComponent(next)}`);
  return s;
}

/** Admin pages: non-admins see a 404 (the admin area is not advertised). */
export async function pageAdmin(): Promise<Session> {
  const s = await currentSession();
  if (!s || s.user.role !== "admin") notFound();
  if (!s.user.mfa_enabled_at || !s.mfa_verified) redirect("/admin/mfa");
  if (Date.now() - s.last_seen_at.getTime() > 60 * 60_000) redirect("/login?next=/admin");
  return s;
}
