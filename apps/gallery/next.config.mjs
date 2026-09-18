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
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
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
