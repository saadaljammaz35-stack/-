import "server-only";
import { log } from "@/lib/log";
import { appFileHeaders, PREVIEW_SHIM, resolveRequest, type AppFiles } from "./files";

const NOT_FOUND_PAGE = `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>404</title><body style="font-family:system-ui;display:grid;place-items:center;min-height:90vh;color:#555"><p>هذه الصفحة غير موجودة — This page does not exist.</p></body></html>`;

function notFound(): Response {
  const h = appFileHeaders("404.html", { cache: "none" });
  return new Response(NOT_FOUND_PAGE, { status: 404, headers: h });
}

/** Inserts the shim (and, for the bare app URL, a <base>) at the start of <head>. */
function prepareHtml(html: string, base: string | null): string {
  const inject = PREVIEW_SHIM + (base ? `<base href="${base}">` : "");
  const m = /<head[^>]*>/i.exec(html);
  if (m) return html.slice(0, m.index + m[0].length) + inject + html.slice(m.index + m[0].length);
  const d = /<!doctype[^>]*>/i.exec(html);
  if (d) return html.slice(0, d.index + d[0].length) + inject + html.slice(d.index + d[0].length);
  return inject + html;
}

/**
 * Serves one file of a generated app with the sandbox headers. `root` is the
 * URL prefix of the app ("/p/<slug>/"); the bare URL gets a <base> so that
 * relative links resolve inside the app.
 */
export async function serveAppFile(
  load: () => Promise<AppFiles | null>,
  requested: string[] | undefined,
  opts: { root: string; cache: "none" | "short" },
): Promise<Response> {
  try {
    const files = await load();
    if (!files) return notFound();
    const parts = requested ?? [];
    const path = resolveRequest(files, parts);
    if (!path) return notFound();
    let body = files[path]!;
    if (/\.html?$/i.test(path)) body = prepareHtml(body, parts.length === 0 ? opts.root : null);
    return new Response(body, { status: 200, headers: appFileHeaders(path, opts) });
  } catch (err) {
    log.error("studio.serve_failed", { error: err instanceof Error ? err : String(err) });
    return new Response("Temporarily unavailable", { status: 503, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
  }
}
