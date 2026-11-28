import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

/**
 * Crawlers may index the public site. Everything that needs sign-in is
 * disallowed here; the dynamic private pages (/reports/[id], /log/[id],
 * /shared/[id]) also carry robots noindex in their own metadata, and the
 * demo pages (/reports/demo, /log/demo) stay crawlable because their
 * prefixes are not disallowed.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/account",
          "/projects",
          "/today",
          "/confirm",
          "/invite",
          "/trial",
          "/api",
          "/shared",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
