import { notFound } from "next/navigation";
import { StudioWorkspace } from "@/components/StudioWorkspace";
import { projectDetail } from "@/lib/ai/studio/studio";
import { withUser } from "@/lib/db/pool";
import { AppError } from "@/lib/http/errors";
import { getDict, requireSession } from "@/lib/server/session";

export const metadata = { title: "App Studio" };

export default async function StudioProjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const s = await requireSession();
  const { t } = await getDict();
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const detail = await withUser(s.auth.userId, (db) => projectDetail(db, s.auth.userId, id)).catch((err) => {
    if (err instanceof AppError && err.code === "NOT_FOUND") return null;
    throw err;
  });
  if (!detail) notFound();
  return <StudioWorkspace t={t} initial={detail} autoStart={sp.start === "1"} />;
}
