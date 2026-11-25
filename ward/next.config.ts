import type { NextConfig } from 'next';

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
];

const config: NextConfig = {
  poweredByHeader: false,
  agentRules: false,
  reactStrictMode: true,
  // PGlite ships WASM + data files and postgres.js uses Node sockets: keep both out of the bundle.
  // The Sandbox/Blob SDKs are plain Node libraries used only on the server.
  serverExternalPackages: ['@electric-sql/pglite', 'postgres', 'mammoth', 'unpdf', '@vercel/sandbox'],
  outputFileTracingIncludes: {
    // The SQL migrations are read at run time by /api/setup (and the embedded dev database).
    '/api/setup': ['./supabase/migrations/**/*.sql'],
    // Any request can drain the job queue, and a montage job ships the media runner and the
    // caption font into a Vercel Sandbox: keep those files next to every server function.
    '/**': ['./media-runner/runner.mjs', './media-runner/transcribe.py', './public/fonts/WARDTypeOriginal-Bold.ttf'],
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      {
        source: '/os/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
          { key: 'Cache-Control', value: 'no-store' },
        ],
      },
      { source: '/api/os/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex' }, { key: 'Cache-Control', value: 'no-store' }] },
      {
        source: '/fonts/:file*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
};

export default config;
