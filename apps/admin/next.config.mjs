/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  // The admin plane is internal. Nothing here should be indexed, embedded, or
  // reachable from a customer-facing origin.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; frame-ancestors 'none'; object-src 'none'",
          },
        ],
      },
    ];
  },
  transpilePackages: ['@nabd/shared', '@nabd/ui', '@nabd/security', '@nabd/ledger'],
};
