import { NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { currentSession } from "@/lib/auth";
import { one } from "@/lib/db";
import { notFound, unauthorized } from "@/lib/errors";
import { route } from "@/lib/http";
import { storage } from "@/lib/storage";

type Ctx = { params: Promise<{ id: string }> };

/** Owner (or a verified admin) gets a 5-minute presigned link; everyone else gets 404. */
export const GET = route<Ctx>("evidence.file", async (_req, { params }) => {
  const s = await currentSession();
  if (!s) throw unauthorized();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) throw notFound();
  const isAdmin = s.user.role === "admin" && s.mfa_verified && Boolean(s.user.mfa_enabled_at);
  const ev = await one<{ storage_key: string; detected_mime: string | null; user_id: string }>(
    `SELECT storage_key, detected_mime, user_id FROM evidence WHERE id = $1 AND status = 'ready' AND ($2 OR user_id = $3)`,
    [id, isAdmin, s.user.id],
  );
  if (!ev) throw notFound();
  // Every time staff open a customer's file, it is recorded.
  if (ev.user_id !== s.user.id) await audit(s.user.id, "admin.viewed_evidence", { type: "evidence", id });
  const url = await storage().presignGet(ev.storage_key, { ttlSeconds: 300, inline: true, contentType: ev.detected_mime ?? undefined });
  return NextResponse.redirect(url, { status: 302, headers: { "cache-control": "private, no-store" } });
});
