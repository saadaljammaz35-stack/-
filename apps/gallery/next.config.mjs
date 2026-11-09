// The App Router hydrates from inline <script> tags (the RSC payload pushed
// through `self.__next_f`), so a policy without 'unsafe-inline' for scripts
// leaves every client component unhydrated and the page blank. A nonce issued
// per request from middleware is the stricter alternative; this app serves
// demos only. React's dev build also needs eval for its stack frames.
const scriptSrc = [
  "script-src 'self' 'unsafe-inline'",
  ...(process.env.NODE_ENV === 'development' ? ["'unsafe-eval'"] : []),
].join(' ');

/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          // MorphGallery uploads remote images into WebGL, so the image hosts
          // must be allowed here as well as sending CORS headers themselves.
          // Both conditions are required; neither one substitutes for the other.
          // ClothingRailHero uses each photo as a CSS mask for its shadow and
          // shading, and masks are governed by img-src too; its cups are served
          // from this app, so 'self' covers them.
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              scriptSrc,
              "img-src 'self' data: https://images.unsplash.com",
              "style-src 'self' 'unsafe-inline'",
              "frame-ancestors 'none'",
              "object-src 'none'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};
