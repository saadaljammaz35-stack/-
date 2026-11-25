import { NextResponse, type NextRequest } from 'next/server';

/**
 * Runs before every page and API route:
 *   1. A per-request nonce-based Content-Security-Policy (scripts only run with the nonce).
 *   2. A fast gate for WARD OS: no session cookie → login page (or 401 for the API).
 *      The cookie is fully verified on the server (database lookup) by every page and route;
 *      this gate only keeps anonymous visitors away from the private surface.
 */
const PUBLIC_OS_PATHS = new Set(['/os/login', '/api/os/auth/login']);

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
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self'",
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
      source: '/((?!_next/static|_next/image|fonts/|icon.svg|robots.txt).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
