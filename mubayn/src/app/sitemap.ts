import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.APP_URL ?? "";
  return ["", "/faq", "/ai-limits", "/privacy", "/terms", "/contact", "/register"].map((p) => ({ url: `${base}${p}` }));
}
