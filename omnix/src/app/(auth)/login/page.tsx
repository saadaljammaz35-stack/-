import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { getDict, getSession } from "@/lib/server/session";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await getSession()) redirect("/ai");
  const { t, locale } = await getDict();
  return <AuthForm mode="login" t={t} locale={locale} />;
}
