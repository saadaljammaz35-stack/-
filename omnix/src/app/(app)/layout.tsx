import { Shell } from "@/components/Shell";
import { getDict, requireSession } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await requireSession();
  const { t, locale } = await getDict();
  return (
    <Shell t={t} locale={locale} userName={s.user.displayName}>
      {children}
    </Shell>
  );
}
