import { NextResponse, type NextRequest } from 'next/server';

/**
 * Runs before every page and API route:
 *   1. A per-request nonce-based Content-Security-Policy (scripts only run with the nonce).
 *   2. A fast gate for WARD OS: no session cookie → login page (or 401 for the API).
 *      The cookie is fully verified on the server (database lookup) by every page and route;
 *      this gate only keeps anonymous visitors away from the private surface.
 */
const PUBLIC_OS_PATHS = new Set(['/os/login', '/api/os/auth/login']);
// /api/montage/callback/* is outside the /os gate on purpose: the media runner authenticates
// with a one-time token per run, not a session.

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isOs = pathname === '/os' || pathname.startsWith('/os/') || pathname.startsWith('/api/os/');

  if (isOs && !PUBLIC_OS_PATHS.has(pathname)) {
    const hasSession = req.cookies.has('__Host-ward_session') || req.cookies.has('ward_session');
    if (!hasSession) {
      if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
      const url = req.nextUrl.clone();
      url.pathname = '/os/login';
      url.search = '';
      return NextResponse.redirect(url);
    }
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const dev = process.env.NODE_ENV === 'development';
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    // Montage media is served from the private Vercel Blob store through short-lived presigned URLs,
    // and the browser uploads video straight to the Blob API.
    "img-src 'self' blob: data: https://*.blob.vercel-storage.com",
    "media-src 'self' blob: https://*.blob.vercel-storage.com",
    "font-src 'self'",
    "connect-src 'self' https://vercel.com https://*.blob.vercel-storage.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(dev ? [] : ['upgrade-insecure-requests']),
  ].join('; ');

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);
  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set('Content-Security-Policy', csp);
  if (isOs) res.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  return res;
}

export const config = {
  matcher: [
    {
      // api/os/montage/upload streams video bodies of several GB: the proxy would clone (and cap at
      // 10 MB) every request body it sees, so that route skips it and authenticates by itself.
      source: '/((?!_next/static|_next/image|fonts/|icon.svg|robots.txt|api/os/montage/upload).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
