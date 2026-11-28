import type { Metadata } from "next";

/**
 * Shared SEO / link-preview helpers.
 *
 * One canonical site URL, one OG image (1200x630, the size every platform
 * prefers), and complete Open Graph + Twitter Card tags on every shareable
 * page, so WhatsApp, Telegram, Facebook, LinkedIn, iMessage and X all
 * render the same preview. No platform-specific hacks.
 */
export const SITE_URL = "https://siteledger-ai.vercel.app";
export const SITE_NAME = "SiteLedger AI";

export const SITE_DESCRIPTION =
  "Turn a foreman's voice note and site photos into a costed daily site report in naira — checked by a person, costed against the Bill of Quantities, and locked into an append-only dispute log.";

export const SITE_KEYWORDS = [
  "SiteLedger AI",
  "construction daily report",
  "site diary",
  "Bill of Quantities",
  "BoQ costing",
  "Nigeria construction",
  "quantity surveying",
  "dispute log",
  "site report app",
  "Lagos construction",
  "foreman voice note",
  "costed site report",
];

/** The single OG image used everywhere: 1200x630 PNG, public/og-image.png. */
export const OG_IMAGE_ALT =
  "SiteLedger AI — The day's work. With the money attached. Sample locked report: 4-Bedroom Duplex, Lekki Phase 1, ₦1,495,300.";

export const OG_IMAGE = {
  url: "/og-image.png",
  secureUrl: `${SITE_URL}/og-image.png`,
  type: "image/png",
  width: 1200,
  height: 630,
  alt: OG_IMAGE_ALT,
};

type PageMetaOptions = {
  title: string;
  description: string;
  /** Path from the site root, e.g. "/about". Used for canonical + og:url. */
  path: string;
  /** Open Graph type. Defaults to "website". */
  type?: "website" | "article";
  /** ISO date for article pages (report date). */
  publishedTime?: string;
};

/** Full OG + Twitter Card metadata for one public page. */
export function pageMetadata({ title, description, path, type = "website", publishedTime }: PageMetaOptions): Metadata {
  const url = `${SITE_URL}${path}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type,
      url,
      siteName: SITE_NAME,
      locale: "en_NG",
      title,
      description,
      images: [OG_IMAGE],
      ...(type === "article" && publishedTime
        ? { article: { publishedTime, authors: ["Kamarudeen Balogun"] } }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${SITE_URL}/og-image.png`],
    },
  };
}
