import { createHash } from "node:crypto";
import { z } from "zod";
import { audit } from "./audit";
import { one, query, tx } from "./db";
import { AppError, badRequest, conflict, forbidden, notFound } from "./errors";
import { enqueueAnalysis } from "./jobs";
import { IMAGE_TYPES, MAX_IMAGE_BYTES, MAX_VIDEO_BYTES, VIDEO_TYPES, detectMime, imageInfo, videoDurationMs } from "./media";
import { rateLimit } from "./ratelimit";
import { getLimits } from "./settings";
import { storage } from "./storage";

export const MIN_IMAGES = 4;

export const deviceSchema = z.object({
  deviceCategory: z.enum(["phone", "tablet", "laptop", "smartwatch", "console", "camera", "headphones", "other"]),
  brand: z.string().trim().min(1).max(60),
  model: z.string().trim().min(1).max(120),
  storage: z.string().trim().max(40).optional().nullable(),
  color: z.string().trim().max(40).optional().nullable(),
  purchaseContext: z.enum(["buying", "selling", "owner"]),
  sellerClaims: z.string().trim().max(2000).optional().nullable(),
  askingPrice: z.string().trim().max(60).optional().nullable(),
  reportLanguage: z.enum(["ar", "en"]),
});

export type InspectionStatus = "draft" | "queued" | "analyzing" | "completed" | "failed" | "canceled";

export type InspectionRow = {
  id: string;
  user_id: string;
  status: InspectionStatus;
  device_category: string;
  brand: string;
  model: string;
  storage: string | null;
  color: string | null;
  purchase_context: string;
  seller_claims: string | null;
  asking_price: string | null;
  report_language: "ar" | "en";
  created_at: Date;
  updated_at: Date;
  submitted_at: Date | null;
  completed_at: Date | null;
};

export type EvidenceRow = {
  id: string;
  inspection_id: string;
  user_id: string;
  kind: "image" | "video" | "video_frame";
  parent_evidence_id: string | null;
  storage_key: string;
  declared_mime: string;
  detected_mime: string | null;
  bytes: number | null;
  sha256: string | null;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  frame_time_ms: number | null;
  original_filename: string | null;
  label: string | null;
  status: "pending" | "ready" | "rejected";
  rejected_reason: string | null;
  created_at: Date;
};

const isUuid = (v: string) => z.string().uuid().safeParse(v).success;

/**
 * Every customer read goes through an owner filter. A row that exists but
 * belongs to someone else answers exactly like a row that does not exist.
 */
export async function getOwnedInspection(userId: string, inspectionId: string): Promise<InspectionRow> {
  if (!isUuid(inspectionId)) throw notFound();
  const row = await one<InspectionRow>(`SELECT * FROM inspections WHERE id = $1 AND user_id = $2`, [inspectionId, userId]);
  if (!row) throw notFound();
  return row;
}

export async function listInspections(userId: string) {
  return query<InspectionRow & { report_id: string | null; condition_score: number | null }>(
    `SELECT i.*, r.id AS report_id, r.condition_score
       FROM inspections i
       LEFT JOIN LATERAL (SELECT id, condition_score FROM reports WHERE inspection_id = i.id AND status = 'published' ORDER BY version DESC LIMIT 1) r ON true
      WHERE i.user_id = $1 ORDER BY i.created_at DESC`,
    [userId],
  );
}

export async function createInspection(userId: string, input: z.infer<typeof deviceSchema>): Promise<string> {
  await rateLimit(`inspection-create:${userId}`, 30, 3600);
  const drafts = await one<{ n: number }>(`SELECT count(*)::int AS n FROM inspections WHERE user_id = $1 AND status = 'draft'`, [userId]);
  if ((drafts?.n ?? 0) >= 10) throw conflict("too_many_drafts", "You have 10 unfinished inspections. Finish or delete one first.");
  const row = await one<{ id: string }>(
    `INSERT INTO inspections (user_id, device_category, brand, model, storage, color, purchase_context, seller_claims, asking_price, report_language)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [userId, input.deviceCategory, input.brand, input.model, input.storage ?? null, input.color ?? null, input.purchaseContext, input.sellerClaims ?? null, input.askingPrice ?? null, input.reportLanguage],
  );
  await audit(userId, "inspection.created", { type: "inspection", id: row!.id });
  return row!.id;
}

export async function updateInspection(userId: string, inspectionId: string, input: z.infer<typeof deviceSchema>): Promise<void> {
  const insp = await getOwnedInspection(userId, inspectionId);
  if (insp.status !== "draft") throw conflict("locked", "This inspection can no longer be edited");
  await query(
    `UPDATE inspections SET device_category=$3, brand=$4, model=$5, storage=$6, color=$7, purchase_context=$8,
            seller_claims=$9, asking_price=$10, report_language=$11, updated_at=now()
      WHERE id=$1 AND user_id=$2`,
    [inspectionId, userId, input.deviceCategory, input.brand, input.model, input.storage ?? null, input.color ?? null, input.purchaseContext, input.sellerClaims ?? null, input.askingPrice ?? null, input.reportLanguage],
  );
}

export async function deleteDraft(userId: string, inspectionId: string): Promise<void> {
  const insp = await getOwnedInspection(userId, inspectionId);
  if (insp.status !== "draft") throw conflict("locked", "Only unsubmitted inspections can be deleted. Delete your account to remove everything.");
  await storage().deletePrefix(`u/${userId}/i/${inspectionId}/`);
  await query(`DELETE FROM inspections WHERE id = $1 AND user_id = $2`, [inspectionId, userId]);
}

export async function listEvidence(userId: string, inspectionId: string, includeFrames = false): Promise<EvidenceRow[]> {
  return query<EvidenceRow>(
    `SELECT * FROM evidence WHERE inspection_id = $1 AND user_id = $2 AND ($3 OR kind <> 'video_frame') AND status = 'ready'
      ORDER BY kind = 'video_frame', created_at`,
    [inspectionId, userId, includeFrames],
  );
}

export const uploadRequestSchema = z.object({
  filename: z.string().trim().min(1).max(200),
  contentType: z.string().max(100),
  bytes: z.number().int().positive(),
  label: z.string().trim().max(80).optional().nullable(),
});

function extFor(mime: string): string {
  return ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm" } as Record<string, string>)[mime] ?? "bin";
}

export async function requestUpload(userId: string, inspectionId: string, input: z.infer<typeof uploadRequestSchema>) {
  await rateLimit(`upload:${userId}`, 150, 3600);
  const insp = await getOwnedInspection(userId, inspectionId);
  if (insp.status !== "draft") throw conflict("locked", "Evidence can only be added before the inspection is submitted");
  const limits = await getLimits();
  const ct = input.contentType.toLowerCase();
  const isImage = (IMAGE_TYPES as readonly string[]).includes(ct);
  const isVideo = (VIDEO_TYPES as readonly string[]).includes(ct);
  if (ct === "image/heic" || ct === "image/heif") {
    throw badRequest("heic_unsupported", "HEIC photos are not supported. Choose JPEG (on iPhone: Settings › Camera › Formats › Most Compatible).");
  }
  if (!isImage && !isVideo) throw badRequest("type_unsupported", "Only JPEG, PNG, WebP photos and MP4, MOV, WebM videos are accepted");
  if (isVideo && limits.maxVideos === 0) throw badRequest("video_not_allowed", "Video uploads are currently disabled");
  if (isImage && input.bytes > MAX_IMAGE_BYTES) throw badRequest("too_large", "Photos must be 15 MB or smaller");
  if (isVideo && input.bytes > MAX_VIDEO_BYTES) throw badRequest("too_large", "Videos must be 100 MB or smaller");

  const kind = isImage ? "image" : "video";
  return tx(async (db) => {
    // Lock the inspection so parallel uploads cannot exceed the limit.
    await query(`SELECT id FROM inspections WHERE id = $1 FOR UPDATE`, [inspectionId], db);
    const counts = await one<{ n: number }>(
      `SELECT count(*)::int AS n FROM evidence WHERE inspection_id = $1 AND kind = $2
          AND (status = 'ready' OR (status = 'pending' AND created_at > now() - interval '30 minutes'))`,
      [inspectionId, kind],
      db,
    );
    const limit = isImage ? limits.maxImages : limits.maxVideos;
    if ((counts?.n ?? 0) >= limit) throw badRequest("limit_reached", `Up to ${limit} ${kind === "image" ? "photos" : "videos"} per inspection`);
    const ev = await one<{ id: string }>(
      `INSERT INTO evidence (inspection_id, user_id, kind, storage_key, declared_mime, bytes, original_filename, label)
       VALUES ($1, $2, $3, 'pending:' || gen_random_uuid(), $4, $5, $6, $7) RETURNING id`,
      [inspectionId, userId, kind, ct, input.bytes, input.filename, input.label ?? null],
      db,
    );
    const key = `u/${userId}/i/${inspectionId}/e/${ev!.id}.${extFor(ct)}`;
    await query(`UPDATE evidence SET storage_key = $2 WHERE id = $1`, [ev!.id, key], db);
    const put = await storage().presignPut(key, ct, input.bytes);
    return { evidenceId: ev!.id, uploadUrl: put.url, headers: put.headers };
  });
}

/**
 * Confirms an upload actually landed and is what it claims to be: size,
 * content-sniffed type, decodable image / readable video, duration limit.
 * Rejected files are deleted from storage.
 */
export async function completeUpload(userId: string, evidenceId: string): Promise<EvidenceRow> {
  if (!isUuid(evidenceId)) throw notFound();
  const ev = await one<EvidenceRow>(`SELECT * FROM evidence WHERE id = $1 AND user_id = $2`, [evidenceId, userId]);
  if (!ev) throw notFound();
  if (ev.status !== "pending") return ev;
  const head = await storage().head(ev.storage_key);
  if (!head) throw badRequest("not_uploaded", "The file has not reached storage yet");

  const reject = async (reason: string): Promise<never> => {
    await storage().delete(ev.storage_key);
    await query(`UPDATE evidence SET status = 'rejected', rejected_reason = $2 WHERE id = $1`, [ev.id, reason]);
    throw badRequest("evidence_rejected", reason);
  };
  if (ev.bytes && head.bytes !== ev.bytes) return reject("Uploaded size does not match");
  const buf = await storage().get(ev.storage_key);
  const mime = detectMime(buf.subarray(0, 64));
  const sha = createHash("sha256").update(buf).digest("hex");

  if (ev.kind === "image") {
    if (mime === "image/heic") return reject("HEIC photos are not supported. Please upload JPEG.");
    if (!mime || !(IMAGE_TYPES as readonly string[]).includes(mime)) return reject("File content is not a supported photo");
    let dims: { width: number; height: number };
    try {
      dims = await imageInfo(buf);
    } catch (e) {
      return reject(e instanceof Error ? e.message : "Unreadable photo");
    }
    // The same photo twice adds nothing and would overstate the evidence.
    const dup = await one(`SELECT 1 FROM evidence WHERE inspection_id = $1 AND sha256 = $2 AND status = 'ready'`, [ev.inspection_id, sha]);
    if (dup) return reject("This exact photo was already uploaded");
    return (await one<EvidenceRow>(
      `UPDATE evidence SET status='ready', detected_mime=$2, sha256=$3, width=$4, height=$5, bytes=$6, verified_at=now() WHERE id=$1 RETURNING *`,
      [ev.id, mime, sha, dims.width, dims.height, buf.length],
    ))!;
  }
  const limits = await getLimits();
  if (!mime || !(VIDEO_TYPES as readonly string[]).includes(mime)) return reject("File content is not a supported video");
  let duration: number;
  try {
    duration = await videoDurationMs(buf);
  } catch (e) {
    return reject(e instanceof Error ? e.message : "Unreadable video");
  }
  if (duration > limits.maxVideoSeconds * 1000 + 999) return reject(`Video is longer than ${limits.maxVideoSeconds} seconds`);
  if (duration < 2000) return reject("Video is shorter than 2 seconds");
  return (await one<EvidenceRow>(
    `UPDATE evidence SET status='ready', detected_mime=$2, sha256=$3, duration_ms=$4, bytes=$5, verified_at=now() WHERE id=$1 RETURNING *`,
    [ev.id, mime, sha, duration, buf.length],
  ))!;
}

export async function deleteEvidence(userId: string, evidenceId: string): Promise<void> {
  if (!isUuid(evidenceId)) throw notFound();
  const ev = await one<EvidenceRow>(`SELECT * FROM evidence WHERE id = $1 AND user_id = $2`, [evidenceId, userId]);
  if (!ev) throw notFound();
  const insp = await getOwnedInspection(userId, ev.inspection_id);
  if (insp.status !== "draft") throw conflict("locked", "Evidence cannot be removed after submission");
  await storage().delete(ev.storage_key);
  await query(`DELETE FROM evidence WHERE id = $1`, [ev.id]);
}

export async function readyCounts(inspectionId: string): Promise<{ images: number; videos: number; pending: number }> {
  const r = await one<{ images: number; videos: number; pending: number }>(
    `SELECT count(*) FILTER (WHERE kind='image' AND status='ready')::int AS images,
            count(*) FILTER (WHERE kind='video' AND status='ready')::int AS videos,
            count(*) FILTER (WHERE status='pending' AND kind <> 'video_frame' AND created_at > now() - interval '30 minutes')::int AS pending
       FROM evidence WHERE inspection_id = $1`,
    [inspectionId],
  );
  return r ?? { images: 0, videos: 0, pending: 0 };
}

/** How many free inspections the customer has left this calendar month (UTC). */
export async function quotaFor(userId: string): Promise<{ used: number; limit: number; remaining: number; resetsAt: Date }> {
  const limits = await getLimits();
  const r = await one<{ used: number; resets: Date }>(
    `SELECT count(*)::int AS used, date_trunc('month', now()) + interval '1 month' AS resets
       FROM inspections
      WHERE user_id = $1 AND submitted_at >= date_trunc('month', now()) AND status NOT IN ('failed', 'canceled')`,
    [userId],
  );
  const used = r?.used ?? 0;
  return { used, limit: limits.monthlyInspectionsPerUser, remaining: Math.max(0, limits.monthlyInspectionsPerUser - used), resetsAt: r!.resets };
}

/** Submits a draft for analysis. Free, but bounded by the operator's quotas. */
export async function submitInspection(user: { id: string; email_verified_at: Date | null }, inspectionId: string): Promise<void> {
  if (!user.email_verified_at) throw forbidden("Verify your e-mail address before submitting");
  await rateLimit(`submit:${user.id}`, 10, 3600);
  const limits = await getLimits();
  if (!limits.submissionsOpen) throw new AppError(503, "submissions_paused", "New inspections are paused. Please try again later.");
  await tx(async (db) => {
    // Serialise submissions per user so the quota cannot be raced.
    await query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`submit:${user.id}`], db);
    const insp = await one<InspectionRow>(`SELECT * FROM inspections WHERE id = $1 AND user_id = $2 FOR UPDATE`, [inspectionId, user.id], db);
    if (!insp) throw notFound();
    if (insp.status !== "draft") throw conflict("already_submitted", "This inspection was already submitted");
    // Uploads that were started but never finished are abandoned.
    await query(`DELETE FROM evidence WHERE inspection_id = $1 AND status IN ('pending','rejected') AND created_at < now() - interval '30 minutes'`, [inspectionId], db);
    const counts = await readyCounts(inspectionId);
    if (counts.pending > 0) throw badRequest("uploads_pending", "Wait for all uploads to finish");
    if (counts.images < MIN_IMAGES) throw badRequest("not_enough_evidence", `Add at least ${MIN_IMAGES} photos`);
    const used = await one<{ n: number }>(
      `SELECT count(*)::int AS n FROM inspections WHERE user_id = $1 AND submitted_at >= date_trunc('month', now()) AND status NOT IN ('failed','canceled')`,
      [user.id],
      db,
    );
    if ((used?.n ?? 0) >= limits.monthlyInspectionsPerUser) {
      throw new AppError(429, "monthly_quota_reached", `You have used your ${limits.monthlyInspectionsPerUser} free inspections for this month.`);
    }
    await query(`SELECT pg_advisory_xact_lock(727275)`, [], db);
    const today = await one<{ n: number }>(`SELECT count(*)::int AS n FROM inspections WHERE submitted_at >= date_trunc('day', now())`, [], db);
    if ((today?.n ?? 0) >= limits.dailyAnalysesGlobal) {
      throw new AppError(503, "daily_capacity_reached", "Today's analysis capacity is full. Please submit again tomorrow.");
    }
    await query(`UPDATE inspections SET status='queued', submitted_at=now(), updated_at=now() WHERE id=$1`, [inspectionId], db);
    await enqueueAnalysis(inspectionId, "submission", db);
    await audit(user.id, "inspection.submitted", { type: "inspection", id: inspectionId }, { images: counts.images, videos: counts.videos }, null, db);
  });
}
