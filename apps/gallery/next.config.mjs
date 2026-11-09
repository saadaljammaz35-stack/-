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
          // ClothingRailHero has the same two needs for a different reason: it
          // uses each garment photo as a CSS mask for its shadow and shading,
          // and CSS masks are fetched in CORS mode and governed by img-src.
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              scriptSrc,
              "img-src 'self' data: https://images.unsplash.com https://cdn.21st.dev",
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
