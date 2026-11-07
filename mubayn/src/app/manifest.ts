import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "مُبيّن MUBAYN",
    short_name: "مُبيّن",
    description: "اعرف وش حالة الجهاز المستعمل قبل لا تدفع",
    lang: "ar",
    dir: "rtl",
    start_url: "/",
    display: "standalone",
    background_color: "#F3EFE6",
    theme_color: "#121A24",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/brand/mubayn-mark-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
