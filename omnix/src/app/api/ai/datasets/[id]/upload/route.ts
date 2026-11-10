import { addItems, parseDatasetFile } from "@/lib/ai/training/datasets";
import { withUser } from "@/lib/db/pool";
import { AppError } from "@/lib/http/errors";
import { json, parseId, route } from "@/lib/http/route";
import { sniffKnowledgeFile } from "@/lib/security/file-sniff";

export const runtime = "nodejs";

/** Upload JSONL / JSON training data: {messages}, {prompt, completion} or {instruction, input, output} per record. */
export const POST = route.auth({ sessionOnly: true, rateLimit: { name: "dataset-upload", limit: 30, windowSec: 3600 } }, async ({ auth, params, req }) => {
  const id = parseId(params.id, "Dataset");
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new AppError("VALIDATION_FAILED", "file is required");
  if (file.size > 20 * 1024 * 1024) throw new AppError("PAYLOAD_TOO_LARGE", "Dataset files are limited to 20 MB");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const sniff = sniffKnowledgeFile(file.name, bytes);
  if (!sniff.ok || !["application/json", "application/x-ndjson"].includes(sniff.mime!)) {
    throw new AppError("UNSUPPORTED_MEDIA_TYPE", sniff.reason ?? "Upload a .jsonl or .json file");
  }
  const { records, errors } = parseDatasetFile(new TextDecoder().decode(bytes));
  if (records.length === 0) throw new AppError("VALIDATION_FAILED", "No usable records found", { details: errors.slice(0, 20) });
  if (records.length > 50_000) throw new AppError("PAYLOAD_TOO_LARGE", "At most 50,000 records per upload");
  return withUser(auth.userId, async (db) => json({ added: await addItems(db, id, records, "upload"), skippedLines: errors.slice(0, 50) }, { status: 201 }));
});
