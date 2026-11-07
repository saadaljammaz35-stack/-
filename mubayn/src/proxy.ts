import { NextResponse, type NextRequest } from "next/server";

/**
 * Per-request CSP nonce (Next.js applies it to its own scripts), plus the
 * storage origin so browsers may upload to / load from presigned URLs.
 */
function storageOrigin(): string {
  if (process.env.STORAGE_DRIVER !== "s3") return "";
  try {
    if (process.env.S3_ENDPOINT) {
      const u = new URL(process.env.S3_ENDPOINT);
      return process.env.S3_FORCE_PATH_STYLE === "true" ? u.origin : `${u.protocol}//${process.env.S3_BUCKET}.${u.host}`;
    }
    return `https://${process.env.S3_BUCKET}.s3.${process.env.S3_REGION}.amazonaws.com`;
  } catch {
    return "";
  }
}

/**
 * Pages served on any other host (mubayn.vercel.app, per-deployment URLs)
 * are sent to APP_URL, because the CSRF check only accepts requests whose
 * Origin is APP_URL: forms on another host would all fail with 403.
 */
function canonicalRedirect(request: NextRequest): NextResponse | null {
  if (process.env.NODE_ENV !== "production") return null;
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  let canonical: URL;
  try {
    canonical = new URL(process.env.APP_URL ?? "");
  } catch {
    return null;
  }
  const host = request.headers.get("host");
  if (!host || host === canonical.host) return null;
  return NextResponse.redirect(new URL(request.nextUrl.pathname + request.nextUrl.search, canonical.origin), 308);
}

export function proxy(request: NextRequest) {
  const moved = canonicalRedirect(request);
  if (moved) return moved;
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const dev = process.env.NODE_ENV === "development";
  const store = storageOrigin();
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' blob: data: ${store}`.trim(),
    `media-src 'self' blob: ${store}`.trim(),
    `connect-src 'self' ${store}`.trim(),
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    dev ? "" : "upgrade-insecure-requests",
  ]
    .filter(Boolean)
    .join("; ");
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);
  const res = NextResponse.next({ request: { headers } });
  res.headers.set("Content-Security-Policy", csp);
  res.headers.set("X-Frame-Options", "DENY");
  return res;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|icon.svg).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
