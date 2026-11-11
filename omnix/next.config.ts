import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // The floating dev-tools badge sits over the phone tab bar in RTL layouts.
  devIndicators: false,
  // Native / binary packages load from node_modules at run time.
  serverExternalPackages: ["pg", "@huggingface/transformers", "onnxruntime-node", "unpdf", "mammoth"],
  // Serverless hosts (Vercel) cap a function at 250 MB, and the in-process
  // model runtime alone is ~550 MB. It is only loaded on demand
  // (OMNIX_LOCAL_ONNX_ENABLED / EMBEDDING_PROVIDER=local_onnx), which a
  // serverless deployment does not use, so leave it out of the traces there.
  ...(process.env.VERCEL
    ? {
        outputFileTracingExcludes: Object.fromEntries(
          ["/*", "/**"].map((route) => [
            route,
            [
              "node_modules/onnxruntime-node/**", "node_modules/onnxruntime-web/**", "node_modules/@huggingface/transformers/**",
              "node_modules/sharp/**", "node_modules/@img/**", ".models/**", ".storage*/**", "mobile/**", "worker/**", "tests/**", "e2e/**",
            ],
          ]),
        ),
      }
    : {}),
  experimental: {
    serverActions: { bodySizeLimit: "1mb" },
  },
  async headers() {
    return [
      {
        // Generated apps (/preview, /p) send their own sandbox policy; see src/lib/ai/studio/files.ts.
        source: "/:path((?!preview/|p/).*)",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'" + (process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'"),
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self' data:",
              "connect-src 'self'",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
      {
        source: "/:prefix(preview|p)/:path*",
        headers: [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }],
      },
    ];
  },
};

export default nextConfig;
