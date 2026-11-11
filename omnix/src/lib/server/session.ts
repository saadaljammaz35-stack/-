import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { resolveSessionToken, SESSION_COOKIE, WORKSPACE_COOKIE, type AuthContext } from "@/lib/auth/session";
import { withUser } from "@/lib/db/pool";
import { DICTS, isLocale, type Dict, type Locale } from "@/lib/i18n";

export interface PageSession {
  auth: AuthContext;
  user: { id: string; email: string; displayName: string; locale: Locale; theme: "system" | "light" | "dark" };
}

export async function getLocale(): Promise<Locale> {
  const c = (await cookies()).get("omnix_locale")?.value;
  return isLocale(c) ? c : "ar";
}

export async function getDict(): Promise<{ locale: Locale; t: Dict }> {
  const locale = await getLocale();
  return { locale, t: DICTS[locale] };
}

export async function getSession(): Promise<PageSession | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const auth = await resolveSessionToken(token, jar.get(WORKSPACE_COOKIE)?.value).catch(() => null);
  if (!auth) return null;
  const u = await withUser(auth.userId, (db) => db.query("SELECT id, email, display_name, locale, theme FROM users WHERE id = $1", [auth.userId]));
  const r = u.rows[0];
  return { auth, user: { id: r.id, email: r.email, displayName: r.display_name, locale: r.locale, theme: r.theme } };
}

export async function requireSession(): Promise<PageSession> {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}
