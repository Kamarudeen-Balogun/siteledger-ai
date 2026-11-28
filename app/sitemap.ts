import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

/**
 * Public, indexable routes only. Every route that needs sign-in
 * (account, projects, today, confirm, reports, log, shared, trial)
 * is excluded — those pages carry robots noindex themselves.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes: Array<{ path: string; changeFrequency: "weekly" | "monthly" | "yearly"; priority: number }> = [
    { path: "/", changeFrequency: "weekly", priority: 1 },
    { path: "/reports/demo", changeFrequency: "monthly", priority: 0.9 },
    { path: "/log/demo", changeFrequency: "monthly", priority: 0.8 },
    { path: "/about", changeFrequency: "monthly", priority: 0.8 },
    { path: "/help", changeFrequency: "monthly", priority: 0.7 },
    { path: "/contact", changeFrequency: "yearly", priority: 0.5 },
    { path: "/privacy", changeFrequency: "yearly", priority: 0.4 },
    { path: "/terms", changeFrequency: "yearly", priority: 0.4 },
  ];
  return routes.map(({ path, changeFrequency, priority }) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  }));
}
