import { createDocument, processDocument } from "@/lib/ai/rag/knowledge";
import { env } from "@/lib/config/env";
import { AppError } from "@/lib/http/errors";
import { json, route } from "@/lib/http/route";
import { runInBackground } from "@/lib/jobs/background";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * multipart/form-data: file (required), title, category, tags (comma separated),
 * replaceDocumentId (upload a new revision of an existing document).
 * The file type is decided from its bytes, not its name or Content-Type.
 */
export const POST = route.auth(
  { scope: "knowledge:write", rateLimit: { name: "knowledge-upload", limit: 60, windowSec: 3600 } },
  async ({ auth, req, requestId, ip }) => {
    const max = env().OMNIX_MAX_UPLOAD_MB * 1024 * 1024;
    const len = Number(req.headers.get("content-length") ?? "0");
    if (len > max + 64 * 1024) throw new AppError("PAYLOAD_TOO_LARGE", `Files are limited to ${env().OMNIX_MAX_UPLOAD_MB} MB`);
    if (!(req.headers.get("content-type") ?? "").startsWith("multipart/form-data")) {
      throw new AppError("UNSUPPORTED_MEDIA_TYPE", "Expected multipart/form-data");
    }
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new AppError("VALIDATION_FAILED", "file is required");
    if (file.size > max) throw new AppError("PAYLOAD_TOO_LARGE", `Files are limited to ${env().OMNIX_MAX_UPLOAD_MB} MB`);
    const replace = form.get("replaceDocumentId");
    if (replace !== null && !/^[0-9a-f-]{36}$/.test(String(replace))) throw new AppError("VALIDATION_FAILED", "Invalid replaceDocumentId");
    const doc = await createDocument(
      { ...auth, requestId, ip },
      {
        filename: file.name,
        data: new Uint8Array(await file.arrayBuffer()),
        title: form.get("title")?.toString().slice(0, 255),
        category: form.get("category")?.toString().slice(0, 80) || null,
        tags: form.get("tags")?.toString().split(",").slice(0, 20),
        replaceDocumentId: replace ? String(replace) : undefined,
      },
    );
    await runInBackground("knowledge.process", () => processDocument(auth.userId, doc.id));
    return json({ document: doc }, { status: 201 });
  },
);
