import type { MetadataRoute } from "next";

// Installable web app: on iPhone, Safari → Share → "Add to Home Screen"
// opens OMNIX full screen with its own icon (no App Store needed).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "OMNIX",
    short_name: "OMNIX",
    description: "Private AI models — OMNIX Personal Intelligence",
    start_url: "/ai/chat",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F6F7F9",
    theme_color: "#F6F7F9",
    lang: "ar",
    dir: "rtl",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
