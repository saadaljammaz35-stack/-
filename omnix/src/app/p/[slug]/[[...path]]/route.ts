import { publishedApp } from "@/lib/ai/studio/studio";
import { serveAppFile } from "@/lib/ai/studio/serve";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A published app, open to anyone with the link. */
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string; path?: string[] }> }): Promise<Response> {
  const { slug, path } = await ctx.params;
  return serveAppFile(async () => (await publishedApp(slug))?.files ?? null, path, { root: `/p/${slug}/`, cache: "short" });
}
