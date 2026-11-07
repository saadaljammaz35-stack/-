import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { currentSession } from "@/lib/auth";
import { unauthorized } from "@/lib/errors";
import { route } from "@/lib/http";
import { ensureReportPdf } from "@/lib/pdf";
import { getOwnedReport, getReportForAdmin, shortId } from "@/lib/reports";
import { storage } from "@/lib/storage";

export const maxDuration = 60;
type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>("reports.pdf", async (_req, { params }) => {
  const s = await currentSession();
  if (!s) throw unauthorized();
  const { id } = await params;
  const isAdmin = s.user.role === "admin" && s.mfa_verified && Boolean(s.user.mfa_enabled_at);
  // Ownership check first: throws 404 for anyone else's report.
  const full = isAdmin ? await getReportForAdmin(id) : await getOwnedReport(s.user.id, id);
  if (full.report.user_id !== s.user.id) await audit(s.user.id, "admin.downloaded_report", { type: "report", id: full.report.id });
  const key = await ensureReportPdf(full.report.id);
  const url = await storage().presignGet(key, {
    filename: `MUBAYN-${shortId(full.report.id)}-v${full.report.version}.pdf`,
    ttlSeconds: 300,
    contentType: "application/pdf",
  });
  return NextResponse.redirect(url, { status: 302, headers: { "cache-control": "private, no-store" } });
});
