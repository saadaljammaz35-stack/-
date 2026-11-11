import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { getDict, getSession } from "@/lib/server/session";

export const metadata = { title: "Create account" };

export default async function RegisterPage() {
  if (await getSession()) redirect("/ai");
  const { t, locale } = await getDict();
  return <AuthForm mode="register" t={t} locale={locale} />;
}
