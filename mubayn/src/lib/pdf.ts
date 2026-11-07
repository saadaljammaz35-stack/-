import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { chromium, type Browser } from "playwright-core";
import { LOGO_MARK_SVG } from "@/components/logo";
import { config } from "./config";
import { one, query } from "./db";
import { t, type Key, type Locale } from "./i18n";
import { thumbnail } from "./media";
import { areaLabel, mmss, SEVERITY_ORDER } from "./report-labels";
import { getReportForAdmin, shortId, type FullReport } from "./reports";
import { storage } from "./storage";

/**
 * Report PDFs are rendered by headless Chromium from HTML, because it shapes
 * Arabic correctly (joining, RTL, mixed numerals) where PDF libraries do not.
 * The cited evidence is embedded as thumbnails so the PDF stands on its own.
 */

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

async function fontFace(): Promise<string> {
  const dir = path.join(process.cwd(), "src/assets/fonts");
  const [reg, bold] = await Promise.all([readFile(path.join(dir, "PlexArabic-Regular.ttf")), readFile(path.join(dir, "PlexArabic-SemiBold.ttf"))]);
  return `@font-face{font-family:Plex;src:url(data:font/ttf;base64,${reg.toString("base64")});font-weight:400}
@font-face{font-family:Plex;src:url(data:font/ttf;base64,${bold.toString("base64")});font-weight:600}`;
}

const SEV_COLORS: Record<string, string> = { info: "#3d6b8c", minor: "#6b7a3a", moderate: "#b7791f", major: "#c2410c", critical: "#b91c1c" };

export async function reportHtml(full: FullReport): Promise<string> {
  const { report, findings, inspection, attempt, evidence } = full;
  const L: Locale = report.language;
  const tr = (k: Key) => t(L, k);
  const b = report.body;
  const refOf = new Map(evidence.map((e) => [e.id, e.ref]));
  const thumbs = new Map<string, string>();
  for (const e of evidence) {
    try {
      const buf = await thumbnail(await storage().get(e.storage_key));
      thumbs.set(e.id, `data:image/jpeg;base64,${buf.toString("base64")}`);
    } catch {
      /* evidence may have been removed by an account deletion race; leave the slot empty */
    }
  }
  const date = new Intl.DateTimeFormat(L === "ar" ? "ar-SA-u-nu-latn-ca-gregory" : "en-GB", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Riyadh" });
  const sorted = [...findings].sort((a, z) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[z.severity] || a.position - z.position);
  const issues = sorted.filter((f) => f.severity !== "info").slice(0, 5);
  const good = sorted.find((f) => f.severity === "info");
  const checks = b.recommended_checks.slice(0, 4);
  const num = new Intl.NumberFormat(L === "ar" ? "ar-SA-u-nu-latn" : "en-GB");
  const p = b.price_estimate ?? null;
  const priceBox = !("price_estimate" in b)
    ? ""
    : `<div class="price"><div class="muted small">${esc(tr("rp_price"))}</div>${
        p && p.low !== null && p.high !== null
          ? `<div class="range">${num.format(p.low)} – ${num.format(p.high)} <span>${esc(tr("rp_currency"))}</span></div>`
          : `<div>${esc(tr("rp_price_none"))}</div>`
      }${p && p.asking_price_verdict !== "no_asking_price" ? `<div>${esc(tr("rp_asking"))}: <b>${esc(tr(`ask_${p.asking_price_verdict}` as Key))}</b></div>` : ""}${
        p?.basis ? `<div class="small">${esc(p.basis)}</div>` : ""
      }${p && p.sources.length ? `<div class="small muted">${esc(tr("rp_sources"))}: ${p.sources.map((s) => esc(new URL(s.url).hostname.replace(/^www\./, ""))).join(" · ")}</div>` : ""}<div class="small muted">${esc(tr("rp_price_note"))}</div></div>`;
  const list = (items: string[]) => (items.length ? `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : `<p class="muted">—</p>`);
  const refs = (ids: string[]) => ids.map((id) => `<span class="ref">${esc(refOf.get(id) ?? "?")}</span>`).join(" ");

  return `<!doctype html><html lang="${L}" dir="${L === "ar" ? "rtl" : "ltr"}"><head><meta charset="utf-8"><style>
${await fontFace()}
@page{size:A4;margin:16mm 14mm 18mm}
*{box-sizing:border-box}body{font-family:Plex,sans-serif;color:#17202b;font-size:10.5pt;line-height:1.55;margin:0}
h1{font-size:19pt;margin:0 0 2mm;font-weight:600}h2{font-size:12.5pt;margin:7mm 0 2.5mm;font-weight:600;border-bottom:1.5px solid #e6dfd1;padding-bottom:1.5mm}
.top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #17202b;padding-bottom:4mm}
.brand{display:flex;align-items:center;gap:2.5mm;font-weight:600;font-size:13pt;letter-spacing:.04em}.brand svg{width:8mm;height:8mm;flex:none}.muted{color:#5b6573}.small{font-size:8.5pt}
.kpis{display:flex;gap:4mm;margin-top:5mm}.kpi{flex:1;border:1px solid #e6dfd1;border-radius:3mm;padding:3mm 4mm;background:#faf8f3}
.kpi b{display:block;font-size:15pt}.f{border:1px solid #e6dfd1;border-radius:2.5mm;padding:3mm 4mm;margin-bottom:2.5mm;page-break-inside:avoid}
.f-h{display:flex;gap:3mm;align-items:center;margin-bottom:1mm}.sev{color:#fff;border-radius:10mm;padding:.4mm 3mm;font-size:8.5pt;font-weight:600}
.ref{display:inline-block;border:1px solid #17202b;border-radius:1.5mm;padding:0 1.5mm;font-size:8pt;font-weight:600;direction:ltr}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:3mm}.ev{border:1px solid #e6dfd1;border-radius:2mm;padding:1.5mm;page-break-inside:avoid}
.ev img{width:100%;height:30mm;object-fit:cover;border-radius:1mm;display:block}.ev div{font-size:7.5pt;margin-top:1mm;word-break:break-all}
table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #eee;padding:1.6mm;text-align:start;vertical-align:top;font-size:9.5pt}
.disc{margin-top:6mm;padding:3mm 4mm;background:#fff7e6;border:1px solid #f0d9a8;border-radius:2mm;font-size:9pt}
.mono{font-family:monospace;direction:ltr;unicode-bidi:embed;font-size:7.5pt}
.price{margin-top:5mm;padding:3.5mm 4.5mm;border:1.5px solid #f2a93b;background:#fdf0d9;border-radius:3mm}.price .range{font-size:20pt;font-weight:600;text-align:${L === "ar" ? "right" : "left"}}.price .range span{font-size:11pt}.price div{margin-top:1mm}
</style></head><body>
<div class="top"><div><div class="brand">${LOGO_MARK_SVG}<span>${esc(tr("brand"))} · MUBAYN</span></div><h1>${esc(tr("rp_title"))}</h1>
<div>${esc(inspection.brand)} ${esc(inspection.model)}${inspection.storage ? ` · ${esc(inspection.storage)}` : ""}${inspection.color ? ` · ${esc(inspection.color)}` : ""}</div></div>
<div class="small muted" style="text-align:end">#${shortId(report.id)}<br>${esc(tr("rp_version"))} ${report.version}<br>${esc(tr("rp_generated"))}: ${esc(date.format(attempt.finished_at ?? report.created_at))}</div></div>
<div class="kpis">
<div class="kpi"><span class="muted small">${esc(tr("rp_overall"))}</span><b>${esc(tr(`cond_${report.overall_condition}` as Key))}</b></div>
<div class="kpi"><span class="muted small">${esc(tr("rp_score"))}</span><b>${report.condition_score} / 100</b></div>
<div class="kpi"><span class="muted small">${esc(tr("rp_confidence"))}</span><b>${esc(tr(`conf_${report.confidence}` as Key))}</b></div>
</div>
<p style="font-size:11.5pt;margin-top:5mm">${esc(b.summary)}</p>
${priceBox}
<h2>${esc(tr("rp_top"))}</h2>
${issues.length ? issues.map((f) => `<div class="f"><div class="f-h"><span class="sev" style="background:${SEV_COLORS[f.severity]}">${esc(tr(`sev_${f.severity}` as Key))}</span><b>${esc(f.title)}</b> ${refs(f.evidence_ids)}</div><div class="small">${esc(f.detail)}</div></div>`).join("") : `<p>${esc(tr("rp_no_issues"))}</p>`}
${good ? `<p class="small">✓ ${esc(good.title)} ${refs(good.evidence_ids)}</p>` : ""}
${checks.length ? `<h2>${esc(tr("rp_checks"))}</h2>${list(checks)}` : ""}
<h2>${esc(tr("rp_photos"))}</h2><div class="grid">${evidence
    .map((e) => `<div class="ev">${thumbs.get(e.id) ? `<img src="${thumbs.get(e.id)}">` : ""}<div><span class="ref">${esc(e.ref)}</span> ${e.kind === "video_frame" ? `${esc(tr("frame_at"))} ${mmss(e.frame_time_ms)}` : esc(tr("photo"))}${e.label ? ` · ${esc(e.label)}` : ""}</div></div>`)
    .join("")}</div>
<div style="page-break-before:always"></div>
<h1 style="font-size:15pt">${esc(tr("rp_details"))}</h1>
<table><tr><th>${esc(tr("rp_device_match"))}</th><td><b>${esc(tr(`match_${b.device_match.matches_declared_device}` as Key))}</b> — ${esc(b.device_match.observed_device)}<br><span class="muted">${esc(b.device_match.reasoning)}</span></td></tr>
<tr><th>${esc(tr("rp_quality"))}</th><td><b>${esc(tr(`q_${b.evidence_quality.rating}` as Key))}</b>${b.evidence_quality.issues.length ? ` — ${b.evidence_quality.issues.map(esc).join("، ")}` : ""}</td></tr>
<tr><th>${esc(tr("rp_confidence"))}</th><td>${esc(tr(`conf_${report.confidence}` as Key))}</td></tr></table>
<h2>${esc(tr("rp_all_findings"))} (${sorted.length})</h2>
${sorted
  .map(
    (f) => `<div class="f"><div class="f-h"><span class="sev" style="background:${SEV_COLORS[f.severity]}">${esc(tr(`sev_${f.severity}` as Key))}</span>
<b>${esc(f.title)}</b><span class="muted small">${esc(areaLabel(f.area, L))} · ${esc(tr("rp_confidence"))}: ${esc(tr(`conf_${f.confidence}` as Key))}</span></div>
<div>${esc(f.detail)}</div><div class="small" style="margin-top:1mm">${esc(tr("rp_evidence"))}: ${refs(f.evidence_ids)}</div></div>`,
  )
  .join("")}
${b.seller_claims_check.length ? `<h2>${esc(tr("rp_claims"))}</h2><table>${b.seller_claims_check.map((c) => `<tr><td style="width:35%">${esc(c.claim)}</td><td style="width:15%"><b>${esc(tr(`v_${c.verdict}` as Key))}</b></td><td>${esc(c.explanation)} ${refs(c.evidence_ids)}</td></tr>`).join("")}</table>` : ""}
<h2>${esc(tr("rp_not_covered"))}</h2>${list(b.areas_not_covered)}
<h2>${esc(tr("rp_limitations"))}</h2>${list(b.limitations)}
<h2>${esc(tr("rp_trace"))}</h2><p class="mono">report ${esc(report.id)} · v${report.version}<br>analysis ${esc(attempt.id)} · ${esc(attempt.model)} · ${esc(attempt.prompt_version)}${attempt.request_id ? ` · ${esc(attempt.request_id)}` : ""}${p?.request_id ? `<br>price ${esc(p.request_id)} · ${p.searches} search` : ""}<br>processed ${esc(new Date(attempt.finished_at ?? report.created_at).toISOString())}${evidence.map((e) => `<br>${esc(e.ref)} sha256 ${esc(e.sha256)}`).join("")}</p>
<div class="disc">${esc(tr("rp_disclaimer"))}</div>
</body></html>`;
}

let browserPromise: Promise<Browser> | null = null;
async function browser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = (async () => {
      const exe = config().CHROMIUM_EXECUTABLE_PATH;
      if (exe) return chromium.launch({ executablePath: exe, args: ["--no-sandbox"] });
      const sparticuz = (await import("@sparticuz/chromium")).default;
      return chromium.launch({ executablePath: await sparticuz.executablePath(), args: sparticuz.args, headless: true });
    })().catch((e) => {
      browserPromise = null;
      throw e;
    });
  }
  return browserPromise;
}

export async function renderPdf(html: string): Promise<Buffer> {
  const b = await browser();
  const page = await b.newPage();
  try {
    // No network: everything (fonts, images) is inlined.
    await page.route("**/*", (r) => (r.request().url().startsWith("data:") ? r.continue() : r.abort()));
    await page.setContent(html, { waitUntil: "load", timeout: 30_000 });
    return Buffer.from(await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true }));
  } finally {
    await page.close();
  }
}

/** Generates and stores the PDF if it does not exist yet. Returns its storage key. */
export async function ensureReportPdf(reportId: string): Promise<string> {
  const existing = await one<{ pdf_storage_key: string | null }>(`SELECT pdf_storage_key FROM reports WHERE id = $1`, [reportId]);
  if (existing?.pdf_storage_key) return existing.pdf_storage_key;
  const full = await getReportForAdmin(reportId);
  const pdf = await renderPdf(await reportHtml(full));
  const key = `u/${full.report.user_id}/i/${full.report.inspection_id}/r/${reportId}.pdf`;
  await storage().put(key, pdf, "application/pdf");
  await query(`UPDATE reports SET pdf_storage_key=$2, pdf_sha256=$3, pdf_generated_at=now() WHERE id=$1`, [reportId, key, createHash("sha256").update(pdf).digest("hex")]);
  return key;
}
