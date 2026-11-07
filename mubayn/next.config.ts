import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Native / binary packages stay out of the bundle and load from node_modules.
  serverExternalPackages: ["sharp", "pg", "playwright-core", "@sparticuz/chromium", "ffmpeg-static"],
  outputFileTracingIncludes: {
    "/**": ["./src/assets/fonts/**", "./node_modules/ffmpeg-static/ffmpeg", "./node_modules/@sparticuz/chromium/bin/**"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
