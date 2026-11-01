import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/booking/manage", "/api"] }],
    sitemap: `${env.siteUrl}/sitemap.xml`,
  };
}
