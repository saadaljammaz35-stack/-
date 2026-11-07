import { config } from "@/lib/config";
import { storage, verifyLocalGrant } from "@/lib/storage";

/**
 * DEVELOPMENT ONLY. Emulates presigned S3 URLs for the local storage driver.
 * Refuses to run unless STORAGE_DRIVER=local, which config.ts forbids in production.
 */
type Ctx = { params: Promise<{ token: string }> };

function guard(): Response | null {
  if (config().STORAGE_DRIVER !== "local" || config().NODE_ENV === "production") return new Response("Not found", { status: 404 });
  return null;
}

export async function PUT(req: Request, { params }: Ctx) {
  const blocked = guard();
  if (blocked) return blocked;
  const g = verifyLocalGrant((await params).token);
  if (!g || g.op !== "put") return new Response("Forbidden", { status: 403 });
  if (req.headers.get("content-type") !== g.ct) return new Response("Content-Type mismatch", { status: 403 });
  const body = Buffer.from(await req.arrayBuffer());
  if (body.length !== g.bytes) return new Response("Content-Length mismatch", { status: 403 });
  await storage().put(g.key, body, g.ct!);
  return new Response(null, { status: 200 });
}

export async function GET(_req: Request, { params }: Ctx) {
  const blocked = guard();
  if (blocked) return blocked;
  const g = verifyLocalGrant((await params).token);
  if (!g || g.op !== "get") return new Response("Forbidden", { status: 403 });
  const head = await storage().head(g.key);
  if (!head) return new Response("Not found", { status: 404 });
  const body = await storage().get(g.key);
  const headers: Record<string, string> = { "content-type": g.ct ?? head.contentType ?? "application/octet-stream", "cache-control": "private, no-store" };
  if (g.fn) headers["content-disposition"] = `${g.inline ? "inline" : "attachment"}; filename="${g.fn.replace(/[^\w.\-]/g, "_")}"`;
  return new Response(new Uint8Array(body), { headers });
}
