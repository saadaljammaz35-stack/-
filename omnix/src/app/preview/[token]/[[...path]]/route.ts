import { previewFiles } from "@/lib/ai/studio/studio";
import { serveAppFile } from "@/lib/ai/studio/serve";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Private preview of one app version; the signed token in the URL is the only credential. */
export async function GET(_req: Request, ctx: { params: Promise<{ token: string; path?: string[] }> }): Promise<Response> {
  const { token, path } = await ctx.params;
  return serveAppFile(() => previewFiles(token), path, { root: `/preview/${token}/`, cache: "none" });
}
