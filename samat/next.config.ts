import type { NextConfig } from 'next';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const supabaseHost = new URL(supabaseUrl);
const wsUrl = supabaseUrl.replace(/^http/, 'ws');

// Content Security Policy. Moyasar's payment form loads from cdn.moyasar.com and talks to
// api.moyasar.com; Apple Pay needs apple-pay-gateway. Nothing else third-party runs on the page.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://cdn.moyasar.com https://applepay.cdn-apple.com https://accounts.google.com" +
    (process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''),
  "style-src 'self' 'unsafe-inline' https://cdn.moyasar.com https://accounts.google.com",
  `img-src 'self' data: blob: ${supabaseUrl} https://cdn.moyasar.com https://*.googleusercontent.com`,
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseUrl} ${wsUrl} https://api.moyasar.com https://*.moyasar.com https://apple-pay-gateway.apple.com https://accounts.google.com`,
  "frame-src 'self' https://accounts.google.com https://*.moyasar.com https://*.3dsecure.io https://*.mastercard.com https://*.visa.com",
  "worker-src 'self' blob:",
  "media-src 'self' data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://*.moyasar.com",
  "frame-ancestors 'none'",
].join('; ');

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: supabaseHost.protocol.replace(':', '') as 'http' | 'https', hostname: supabaseHost.hostname, port: supabaseHost.port, pathname: '/storage/v1/object/public/**' },
    ],
    // Local Supabase runs on 127.0.0.1; Next blocks private IPs unless allowed explicitly.
    dangerouslyAllowLocalIP: process.env.NODE_ENV !== 'production' || supabaseHost.hostname === '127.0.0.1',
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(), payment=(self "https://*.moyasar.com"), identity-credentials-get=(self)' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
};

export default nextConfig;
