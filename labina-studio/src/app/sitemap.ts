import type { MetadataRoute } from "next";
import { getServices } from "@/lib/data/public";
import { env } from "@/lib/env";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const services = await getServices();
  const now = new Date();
  const pages = ["", "/services", "/gallery", "/about", "/faq", "/contact", "/booking"].map((p) => ({
    url: `${env.siteUrl}${p}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: p === "" ? 1 : 0.7,
  }));
  return [
    ...pages,
    ...services.map((s) => ({ url: `${env.siteUrl}/services/${s.slug}`, lastModified: now, changeFrequency: "monthly" as const, priority: 0.6 })),
  ];
}
